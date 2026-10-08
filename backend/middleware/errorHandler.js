const errorHandler = (err, req, res, next) => {
  let error = { ...err };
  error.message = err.message;

  console.error('[ErrorHandler] Error caught:', err);

  // PostgreSQL Duplicate Key / Unique Violation (code 23505) or Mongo code 11000
  if (err.code === '23505' || err.code === 11000) {
    const detail = err.detail || '';
    let message = 'An account with this email address already exists.';
    if (detail.includes('email') || (err.message && err.message.toLowerCase().includes('email'))) {
      message = 'An account with this email address already exists.';
    } else {
      message = 'A record with this duplicate key already exists.';
    }
    return res.status(409).json({ success: false, message });
  }

  // PostgreSQL Invalid UUID representation (code 22P02) or CastError
  if (err.code === '22P02' || err.name === 'CastError') {
    const message = 'Resource not found with specified identifier or invalid ID format.';
    return res.status(404).json({ success: false, message });
  }

  // PostgreSQL Undefined Table (code 42P01)
  if (err.code === '42P01') {
    const message = 'Database table not found. Please ensure Supabase SQL schema migrations have been applied.';
    return res.status(500).json({ success: false, message });
  }

  // Validation error
  if (err.name === 'ValidationError') {
    const message = Object.values(err.errors || {})
      .map((val) => val.message)
      .join(', ') || err.message;
    return res.status(400).json({ success: false, message });
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({ success: false, message: 'Invalid token.' });
  }
  if (err.name === 'TokenExpiredError') {
    return res.status(401).json({ success: false, message: 'Token has expired.' });
  }

  res.status(error.statusCode || (err.status && typeof err.status === 'number' ? err.status : 500)).json({
    success: false,
    message: error.message || 'Server Internal Error',
  });
};

module.exports = errorHandler;
