const mongoose = require('mongoose');

/**
 * Return a clean 404 for malformed MongoDB ObjectIds instead of letting
 * Mongoose throw a CastError and surface a 500.
 */
const validateObjectId = (param = 'id') => (req, res, next) => {
  const value = req.params[param];

  if (!mongoose.Types.ObjectId.isValid(value)) {
    return res.status(404).json({
      success: false,
      message: 'The requested resource was not found.',
    });
  }

  return next();
};

module.exports = validateObjectId;
