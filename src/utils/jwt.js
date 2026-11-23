const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'wedplan_secret_jwt_key_super_secure_2026_production';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

const generateToken = (payload) => {
  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: JWT_EXPIRES_IN,
  });
};

const verifyJWT = (token) => {
  return jwt.verify(token, JWT_SECRET);
};

module.exports = {
  generateToken,
  verifyJWT,
};
