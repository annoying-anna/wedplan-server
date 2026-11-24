const express = require('express');
const router = express.Router();
const {
  register,
  login,
  googleAuth,
  sendLoginOtp,
  verifyLoginOtp,
  getMe,
  updateProfile,
} = require('../controllers/authController');
const { protect } = require('../middleware/auth');

router.post('/register', register);
router.post('/login', login);
router.post('/google', googleAuth);
router.post('/send-otp', sendLoginOtp);
router.post('/verify-otp', verifyLoginOtp);
router.get('/me', protect, getMe);
router.patch('/profile', protect, updateProfile);

module.exports = router;
