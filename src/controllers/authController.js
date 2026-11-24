const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const dns = require('dns').promises;
const nodemailer = require('nodemailer');
const User = require('../models/User');
const { generateToken } = require('../utils/jwt');

// Helper to format user response without sensitive info
const formatUserResponse = (user) => {
  return {
    _id: user._id,
    name: user.name,
    email: user.email,
    image: user.image,
    role: user.role,
    isBlocked: user.isBlocked,
    businessName: user.businessName,
    subscriptionPlan: user.subscriptionPlan,
    subscriptionExpiresAt: user.subscriptionExpiresAt,
    createdAt: user.createdAt,
  };
};

// Automatically downgrade an expired Premium subscription on login.
const normalizeExpiredSubscription = async (user) => {
  if (
    user.subscriptionPlan === 'premium' &&
    user.subscriptionExpiresAt &&
    new Date(user.subscriptionExpiresAt).getTime() < Date.now()
  ) {
    user.subscriptionPlan = 'free';
    user.subscriptionExpiresAt = null;
    await user.save();
  }
  return user;
};

// Verify that the email domain has valid MX records (rejects non-existent domains)
const hasValidEmailDomain = async (email) => {
  const domain = email.split('@')[1];
  if (!domain) return false;
  try {
    const records = await dns.resolveMx(domain);
    return Array.isArray(records) && records.length > 0;
  } catch {
    return false;
  }
};

// Generate a 6-digit OTP, save its hash on the user, and send it to the user's real inbox
const dispatchOtpEmail = async (user, subject, heading, introText) => {
  const code = crypto.randomInt(100000, 999999).toString();
  const salt = await bcrypt.genSalt(10);
  user.otpCode = await bcrypt.hash(code, salt);
  user.otpExpiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes
  await user.save();

  const htmlBody = `
    <div style="font-family: Georgia, serif; max-width: 480px; margin: 0 auto; padding: 32px; background: #FAF8F5; border: 1px solid #E8E2D9; border-radius: 16px;">
      <h2 style="color: #1C1917; margin-bottom: 8px;">${heading}</h2>
      <p style="color: #57534E; font-size: 14px;">Hello ${user.name}, ${introText} This code expires in 10 minutes.</p>
      <div style="margin: 24px 0; padding: 16px; background: #FFFFFF; border: 1px solid #C59B6D; border-radius: 12px; text-align: center; font-size: 28px; letter-spacing: 8px; font-weight: bold; color: #1C1917;">
        ${code}
      </div>
      <p style="color: #78716C; font-size: 12px;">If you did not request this code, you can safely ignore this email.</p>
    </div>
  `;

  if (process.env.SMTP_USER && process.env.SMTP_PASS) {
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: Number(process.env.SMTP_PORT || 587),
      secure: Number(process.env.SMTP_PORT) === 465,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });

    await transporter.sendMail({
      from: `"WedPlan Concierge" <${process.env.SMTP_USER}>`,
      to: user.email,
      subject,
      html: htmlBody,
    });
    return true;
  }

  if (process.env.RESEND_API_KEY) {
    const resp = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: process.env.RESEND_FROM || 'WedPlan Concierge <onboarding@resend.dev>',
        to: [user.email],
        subject,
        html: htmlBody,
      }),
    });
    if (!resp.ok) {
      const errBody = await resp.json().catch(() => ({}));
      throw new Error(errBody.message || 'Resend email delivery failed.');
    }
    return true;
  }

  throw new Error(
    'Email delivery is not configured on the server yet. Please configure SMTP_USER/SMTP_PASS (Gmail App Password) or RESEND_API_KEY.'
  );
};

// @desc    Register a new user (requires 6-digit email verification before activation)
// @route   POST /api/auth/register
// @access  Public
const register = async (req, res) => {
  try {
    const { name, email, password, image, role, businessName } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Please provide name, email, and password.',
      });
    }

    // Role verification: Admin accounts MUST NOT be created through public registration
    if (role === 'admin') {
      return res.status(400).json({
        success: false,
        message: 'Admin accounts cannot be created through public registration.',
      });
    }

    const normalizedEmail = email.toLowerCase().trim();

    // Verify email domain has valid MX records
    const domainValid = await hasValidEmailDomain(normalizedEmail);
    if (!domainValid) {
      return res.status(400).json({
        success: false,
        message: 'Please enter a valid email address with an active mail domain.',
      });
    }

    const assignedRole = role === 'vendor' ? 'vendor' : 'customer';

    // Password validation: min 6 chars, 1 uppercase, 1 lowercase
    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 6 characters long.',
      });
    }
    if (!/[A-Z]/.test(password)) {
      return res.status(400).json({
        success: false,
        message: 'Password must contain at least one uppercase letter.',
      });
    }
    if (!/[a-z]/.test(password)) {
      return res.status(400).json({
        success: false,
        message: 'Password must contain at least one lowercase letter.',
      });
    }

    // Check existing email
    let user = await User.findOne({ email: normalizedEmail });
    if (user && user.isEmailVerified !== false) {
      return res.status(400).json({
        success: false,
        message: 'An account with this email already exists.',
      });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    if (user && user.isEmailVerified === false) {
      // Update unverified pending registration & resend verification code
      user.name = name.trim();
      user.password = hashedPassword;
      if (image) user.image = image;
      user.role = assignedRole;
      user.businessName =
        assignedRole === 'vendor' ? businessName || `${name.trim()}'s Services` : '';
    } else {
      user = await User.create({
        name: name.trim(),
        email: normalizedEmail,
        password: hashedPassword,
        image: image || undefined,
        role: assignedRole,
        businessName:
          assignedRole === 'vendor' ? businessName || `${name.trim()}'s Services` : '',
        subscriptionPlan: 'free',
        isBlocked: false,
        isEmailVerified: false,
      });
    }

    await dispatchOtpEmail(
      user,
      'Verify Your WedPlan Account',
      'Verify Your WedPlan Email',
      'enter the 6-digit verification code below to confirm you own this email address and activate your account.'
    );

    return res.status(201).json({
      success: true,
      requiresVerification: true,
      email: user.email,
      message: `Verification code sent to ${user.email}. Please check your inbox to complete registration.`,
    });
  } catch (error) {
    console.error('Registration Error:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Server error during registration.',
    });
  }
};

// @desc    Verify newly registered email with 6-digit code & activate account
// @route   POST /api/auth/verify-email
// @access  Public
const verifyEmail = async (req, res) => {
  try {
    const { email, code } = req.body;
    if (!email || !code) {
      return res.status(400).json({
        success: false,
        message: 'Please provide both email and the 6-digit verification code.',
      });
    }

    const user = await User.findOne({ email: email.toLowerCase().trim() }).select(
      '+otpCode +otpExpiresAt'
    );

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Account not found.',
      });
    }

    if (!user.otpCode || !user.otpExpiresAt || user.otpExpiresAt.getTime() < Date.now()) {
      return res.status(401).json({
        success: false,
        message: 'Verification code has expired. Please request a new code.',
      });
    }

    const isValid = await bcrypt.compare(code.trim(), user.otpCode);
    if (!isValid) {
      return res.status(401).json({
        success: false,
        message: 'Invalid verification code. Please check your inbox and try again.',
      });
    }

    user.isEmailVerified = true;
    user.otpCode = null;
    user.otpExpiresAt = null;
    await user.save();

    const token = generateToken({ id: user._id, role: user.role });

    return res.status(200).json({
      success: true,
      message: 'Email verified! Welcome to WedPlan.',
      token,
      user: formatUserResponse(user),
    });
  } catch (error) {
    console.error('Verify Email Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error verifying email.',
    });
  }
};

// @desc    Sign in user
// @route   POST /api/auth/login
// @access  Public
const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Please provide both email and password.',
      });
    }

    const user = await User.findOne({ email: email.toLowerCase().trim() }).select('+password');

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password.',
      });
    }

    if (user.isBlocked) {
      return res.status(403).json({
        success: false,
        message: 'Your account is blocked. Please contact support.',
      });
    }

    if (user.isEmailVerified === false) {
      return res.status(403).json({
        success: false,
        requiresVerification: true,
        message: 'Please verify your email address with the 6-digit code sent to your inbox before signing in.',
      });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password.',
      });
    }

    await normalizeExpiredSubscription(user);

    const token = generateToken({ id: user._id, role: user.role });

    return res.status(200).json({
      success: true,
      message: 'Signed in successfully.',
      token,
      user: formatUserResponse(user),
    });
  } catch (error) {
    console.error('Login Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error during login.',
    });
  }
};

// @desc    Google OAuth sign in / up
// @route   POST /api/auth/google
// @access  Public
const googleAuth = async (req, res) => {
  try {
    const { email, name, image, role } = req.body;

    if (!email || !name) {
      return res.status(400).json({
        success: false,
        message: 'Google authentication data missing.',
      });
    }

    let user = await User.findOne({ email: email.toLowerCase().trim() });

    if (user) {
      if (user.isBlocked) {
        return res.status(403).json({
          success: false,
          message: 'Your account is blocked. Please contact support.',
        });
      }
    } else {
      // New user from Google
      const assignedRole = role === 'vendor' ? 'vendor' : 'customer';
      const randomPassword = await bcrypt.hash(Math.random().toString(36).slice(-10) + 'Aa1!', 10);

      user = await User.create({
        name,
        email: email.toLowerCase().trim(),
        password: randomPassword,
        image: image || undefined,
        role: assignedRole,
        businessName: assignedRole === 'vendor' ? `${name}'s Wedding Studio` : '',
        subscriptionPlan: 'free',
        isBlocked: false,
      });
    }

    await normalizeExpiredSubscription(user);

    const token = generateToken({ id: user._id, role: user.role });

    return res.status(200).json({
      success: true,
      message: 'Signed in with Google successfully.',
      token,
      user: formatUserResponse(user),
    });
  } catch (error) {
    console.error('Google Auth Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error during Google authentication.',
    });
  }
};

// @desc    Get current user profile
// @route   GET /api/auth/me
// @access  Private
const getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }
    return res.status(200).json({
      success: true,
      user: formatUserResponse(user),
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Error retrieving profile.' });
  }
};

// @desc    Update profile
// @route   PATCH /api/auth/profile
// @access  Private
const updateProfile = async (req, res) => {
  try {
    const { name, image, businessName } = req.body;

    // Rules: Users must not be able to change their own role or subscription status
    const updateData = {};
    if (name) updateData.name = name.trim();
    if (image) updateData.image = image.trim();
    if (req.user.role === 'vendor' && businessName !== undefined) {
      updateData.businessName = businessName.trim();
    }

    const updatedUser = await User.findByIdAndUpdate(
      req.user._id,
      { $set: updateData },
      { new: true, runValidators: true }
    );

    return res.status(200).json({
      success: true,
      message: 'Profile updated successfully.',
      user: formatUserResponse(updatedUser),
    });
  } catch (error) {
    console.error('Profile Update Error:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Error updating profile.',
    });
  }
};

// @desc    Send 6-digit email verification code for passwordless login
// @route   POST /api/auth/send-otp
// @access  Public
const sendLoginOtp = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email || !email.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Please provide your email address.',
      });
    }

    const user = await User.findOne({ email: email.toLowerCase().trim() });
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'No WedPlan account found with this email address.',
      });
    }

    if (user.isBlocked) {
      return res.status(403).json({
        success: false,
        message: 'Your account has been blocked by an administrator.',
      });
    }

    await dispatchOtpEmail(
      user,
      'Your WedPlan Sign-In Verification Code',
      'WedPlan Atelier Sign-In',
      'use the verification code below to sign in to your account.'
    );

    return res.status(200).json({
      success: true,
      message: `A 6-digit verification code has been sent to ${user.email}.`,
    });
  } catch (error) {
    console.error('Send OTP Error:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to send verification code.',
    });
  }
};

// @desc    Verify 6-digit email verification code & issue JWT
// @route   POST /api/auth/verify-otp
// @access  Public
const verifyLoginOtp = async (req, res) => {
  try {
    const { email, code } = req.body;
    if (!email || !code) {
      return res.status(400).json({
        success: false,
        message: 'Please provide both email and the 6-digit verification code.',
      });
    }

    const user = await User.findOne({ email: email.toLowerCase().trim() }).select(
      '+otpCode +otpExpiresAt'
    );

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid verification request.',
      });
    }

    if (user.isBlocked) {
      return res.status(403).json({
        success: false,
        message: 'Your account has been blocked by an administrator.',
      });
    }

    if (!user.otpCode || !user.otpExpiresAt || user.otpExpiresAt.getTime() < Date.now()) {
      return res.status(401).json({
        success: false,
        message: 'Verification code has expired or was not requested. Please request a new code.',
      });
    }

    const isValid = await bcrypt.compare(code.trim(), user.otpCode);
    if (!isValid) {
      return res.status(401).json({
        success: false,
        message: 'Invalid verification code. Please check and try again.',
      });
    }

    user.otpCode = null;
    user.otpExpiresAt = null;
    await user.save();

    await normalizeExpiredSubscription(user);

    const token = generateToken({ id: user._id, role: user.role });

    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    return res.status(200).json({
      success: true,
      message: 'Verified and signed in successfully!',
      token,
      user: formatUserResponse(user),
    });
  } catch (error) {
    console.error('Verify OTP Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error verifying code.',
    });
  }
};

module.exports = {
  register,
  verifyEmail,
  login,
  googleAuth,
  sendLoginOtp,
  verifyLoginOtp,
  getMe,
  updateProfile,
};
