const jwt = require('jsonwebtoken');
const User = require('../models/User');

const protect = async (req, res, next) => {
  let token;

  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer')
  ) {
    try {
      token = req.headers.authorization.split(' ')[1];
      const decoded = jwt.verify(
        token,
        process.env.JWT_SECRET || 'taskflow_super_secret_jwt_key_2026'
      );

      const user = await User.findById(decoded.id);
      if (!user) {
        return res.status(401).json({
          success: false,
          message: 'User no longer exists. Please log in again.',
        });
      }

      req.user = user;
      next();
    } catch (err) {
      console.error('[AuthMiddleware] Token verification failed:', err.message);
      return res.status(401).json({
        success: false,
        message: 'Invalid or expired authorization token.',
      });
    }
  } else {
    return res.status(401).json({
      success: false,
      message: 'Authorization token required. Access denied.',
    });
  }
};

module.exports = { protect };
