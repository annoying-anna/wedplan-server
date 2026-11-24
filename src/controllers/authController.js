const bcrypt = require('bcryptjs');
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

module.exports = {
  register,
  login,
  googleAuth,
  getMe,
  updateProfile,
};
