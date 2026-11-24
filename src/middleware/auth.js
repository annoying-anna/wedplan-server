const { verifyJWT } = require('../utils/jwt');
const User = require('../models/User');

const protect = async (req, res, next) => {
  let token;

  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer')
  ) {
    token = req.headers.authorization.split(' ')[1];
  } else if (req.cookies && req.cookies.token) {
    token = req.cookies.token;
  }

  if (!token) {
    return res.status(401).json({
      success: false,
      message: 'Not authorized to access this route. Please log in.',
    });
  }

  try {
    const decoded = verifyJWT(token);

    // Fetch user from DB to verify user exists and is not blocked
    const user = await User.findById(decoded.id);

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'The user belonging to this token no longer exists.',
      });
    }

    if (user.isBlocked) {
      return res.status(403).json({
        success: false,
        message: 'Your account has been blocked. Access to protected features is suspended.',
      });
    }

    // Automatically downgrade expired Premium subscriptions.
    if (
      user.subscriptionPlan === 'premium' &&
      user.subscriptionExpiresAt &&
      new Date(user.subscriptionExpiresAt).getTime() < Date.now()
    ) {
      user.subscriptionPlan = 'free';
      user.subscriptionExpiresAt = null;
      await user.save();
    }

    req.user = user;
    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: 'Invalid or expired session token. Please sign in again.',
    });
  }
};

const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `Forbidden: User role '${req.user ? req.user.role : 'guest'}' is not authorized to access this route.`,
      });
    }
    next();
  };
};

const verifyAdmin = authorize('admin');
const verifyVendor = authorize('vendor');
const verifyCustomer = authorize('customer');

// Optional auth: populate req.user if token present, but don't block request
const optionalAuth = async (req, res, next) => {
  let token;
  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer')
  ) {
    token = req.headers.authorization.split(' ')[1];
  } else if (req.cookies && req.cookies.token) {
    token = req.cookies.token;
  }

  if (!token) {
    return next();
  }

  try {
    const decoded = verifyJWT(token);
    const user = await User.findById(decoded.id);
    if (user && !user.isBlocked) {
      req.user = user;
    }
  } catch (err) {
    // Ignore invalid token in optional auth
  }
  next();
};

module.exports = {
  protect,
  authorize,
  verifyAdmin,
  verifyVendor,
  verifyCustomer,
  optionalAuth,
};
