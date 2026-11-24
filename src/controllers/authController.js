const bcrypt = require('bcryptjs');
const crypto = require('crypto');
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

// @desc    Register a new user
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
    const existingUser = await User.findOne({ email: email.toLowerCase().trim() });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'An account with this email already exists.',
      });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const newUser = await User.create({
      name: name.trim(),
      email: email.toLowerCase().trim(),
      password: hashedPassword,
      image: image || undefined,
      role: assignedRole,
      businessName: assignedRole === 'vendor' ? (businessName || `${name.trim()}'s Services`) : '',
      subscriptionPlan: 'free',
      isBlocked: false,
    });

    const token = generateToken({ id: newUser._id, role: newUser.role });

    return res.status(201).json({
      success: true,
      message: 'Account registered successfully.',
      token,
      user: formatUserResponse(newUser),
    });
  } catch (error) {
    console.error('Registration Error:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Server error during registration.',
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

    const code = crypto.randomInt(100000, 999999).toString();
    const salt = await bcrypt.genSalt(10);
    user.otpCode = await bcrypt.hash(code, salt);
    user.otpExpiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes
    await user.save();

    let emailDispatched = false;
    if (process.env.SMTP_USER && process.env.SMTP_PASS) {
      try {
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
          subject: 'Your WedPlan Sign-In Verification Code',
          html: `
            <div style="font-family: Georgia, serif; max-width: 480px; margin: 0 auto; padding: 32px; background: #FAF8F5; border: 1px solid #E8E2D9; border-radius: 16px;">
              <h2 style="color: #1C1917; margin-bottom: 8px;">WedPlan Atelier Sign-In</h2>
              <p style="color: #57534E; font-size: 14px;">Hello ${user.name}, use the verification code below to sign in to your account. This code expires in 10 minutes.</p>
              <div style="margin: 24px 0; padding: 16px; background: #FFFFFF; border: 1px solid #C59B6D; border-radius: 12px; text-align: center; font-size: 28px; letter-spacing: 8px; font-weight: bold; color: #1C1917;">
                ${code}
              </div>
              <p style="color: #78716C; font-size: 12px;">If you did not request this code, you can safely ignore this email.</p>
            </div>
          `,
        });
        emailDispatched = true;
      } catch (mailErr) {
        console.warn('SMTP send failed, falling back to demo OTP preview:', mailErr.message);
      }
    }

    return res.status(200).json({
      success: true,
      message: emailDispatched
        ? `A 6-digit verification code has been sent to ${user.email}.`
        : `Verification code generated for ${user.email}.`,
      emailDispatched,
      ...(emailDispatched ? {} : { demoOtp: code }),
    });
  } catch (error) {
    console.error('Send OTP Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to generate verification code.',
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
  login,
  googleAuth,
  sendLoginOtp,
  verifyLoginOtp,
  getMe,
  updateProfile,
};
