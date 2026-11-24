const jwt = require('jsonwebtoken');

const isProduction = process.env.NODE_ENV === 'production';

// Never fall back to a hard-coded secret in production.
const JWT_SECRET =
  process.env.JWT_SECRET ||
  (isProduction ? null : 'wedplan_local_dev_only_jwt_secret_change_me');

if (!JWT_SECRET) {
  throw new Error(
    'JWT_SECRET is required in production. Add it to your environment variables before starting the server.'
  );
}

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
