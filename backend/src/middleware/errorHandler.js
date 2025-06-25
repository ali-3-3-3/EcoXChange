const { ERROR_MESSAGES } = require('../../../shared/constants');

// Custom error class
class AppError extends Error {
  constructor(message, statusCode, code = null) {
    super(message);
    this.statusCode = statusCode;
    this.status = `${statusCode}`.startsWith('4') ? 'fail' : 'error';
    this.isOperational = true;
    this.code = code;

    Error.captureStackTrace(this, this.constructor);
  }
}

// Handle different types of errors
const handleCastErrorDB = (err) => {
  const message = `Invalid ${err.path}: ${err.value}`;
  return new AppError(message, 400);
};

const handleDuplicateFieldsDB = (err) => {
  const field = Object.keys(err.keyValue)[0];
  const value = err.keyValue[field];
  const message = `Duplicate field value: ${field} = ${value}. Please use another value!`;
  return new AppError(message, 400);
};

const handleValidationErrorDB = (err) => {
  const errors = Object.values(err.errors).map(el => el.message);
  const message = `Invalid input data. ${errors.join('. ')}`;
  return new AppError(message, 400);
};

const handleJWTError = () =>
  new AppError(ERROR_MESSAGES.AUTH.INVALID_CREDENTIALS, 401);

const handleJWTExpiredError = () =>
  new AppError(ERROR_MESSAGES.AUTH.SESSION_EXPIRED, 401);

const handleSequelizeValidationError = (err) => {
  const errors = err.errors.map(error => ({
    field: error.path,
    message: error.message,
    value: error.value
  }));
  
  return new AppError('Validation failed', 400, 'VALIDATION_ERROR', errors);
};

const handleSequelizeUniqueConstraintError = (err) => {
  const field = err.errors[0].path;
  const value = err.errors[0].value;
  const message = `${field} '${value}' already exists`;
  return new AppError(message, 409, 'DUPLICATE_ENTRY');
};

const handleSequelizeForeignKeyConstraintError = (err) => {
  const message = 'Referenced record does not exist';
  return new AppError(message, 400, 'FOREIGN_KEY_CONSTRAINT');
};

const handleBlockchainError = (err) => {
  // Handle common blockchain errors
  if (err.message.includes('insufficient funds')) {
    return new AppError(ERROR_MESSAGES.NETWORK.INSUFFICIENT_FUNDS, 400, 'INSUFFICIENT_FUNDS');
  }
  
  if (err.message.includes('user rejected')) {
    return new AppError(ERROR_MESSAGES.NETWORK.USER_REJECTED, 400, 'USER_REJECTED');
  }
  
  if (err.message.includes('transaction failed')) {
    return new AppError(ERROR_MESSAGES.NETWORK.TRANSACTION_FAILED, 400, 'TRANSACTION_FAILED');
  }
  
  return new AppError('Blockchain operation failed', 500, 'BLOCKCHAIN_ERROR');
};

// Send error response in development
const sendErrorDev = (err, res) => {
  res.status(err.statusCode).json({
    success: false,
    error: err.message,
    code: err.code,
    stack: err.stack,
    details: err.details || null
  });
};

// Send error response in production
const sendErrorProd = (err, res) => {
  // Operational, trusted error: send message to client
  if (err.isOperational) {
    res.status(err.statusCode).json({
      success: false,
      error: err.message,
      code: err.code,
      details: err.details || null
    });
  } else {
    // Programming or other unknown error: don't leak error details
    console.error('ERROR 💥', err);
    
    res.status(500).json({
      success: false,
      error: ERROR_MESSAGES.GENERAL.SOMETHING_WENT_WRONG,
      code: 'INTERNAL_ERROR'
    });
  }
};

// Global error handling middleware
const globalErrorHandler = (err, req, res, next) => {
  err.statusCode = err.statusCode || 500;
  err.status = err.status || 'error';

  if (process.env.NODE_ENV === 'development') {
    sendErrorDev(err, res);
  } else {
    let error = { ...err };
    error.message = err.message;

    // Handle specific error types
    if (error.name === 'CastError') error = handleCastErrorDB(error);
    if (error.code === 11000) error = handleDuplicateFieldsDB(error);
    if (error.name === 'ValidationError') error = handleValidationErrorDB(error);
    if (error.name === 'JsonWebTokenError') error = handleJWTError();
    if (error.name === 'TokenExpiredError') error = handleJWTExpiredError();
    
    // Handle Sequelize errors
    if (error.name === 'SequelizeValidationError') {
      error = handleSequelizeValidationError(error);
    }
    if (error.name === 'SequelizeUniqueConstraintError') {
      error = handleSequelizeUniqueConstraintError(error);
    }
    if (error.name === 'SequelizeForeignKeyConstraintError') {
      error = handleSequelizeForeignKeyConstraintError(error);
    }
    
    // Handle blockchain errors
    if (error.message && (
      error.message.includes('revert') ||
      error.message.includes('gas') ||
      error.message.includes('nonce')
    )) {
      error = handleBlockchainError(error);
    }

    sendErrorProd(error, res);
  }
};

// Async error wrapper
const catchAsync = (fn) => {
  return (req, res, next) => {
    fn(req, res, next).catch(next);
  };
};

// Handle unhandled routes
const handleNotFound = (req, res, next) => {
  const err = new AppError(`Can't find ${req.originalUrl} on this server!`, 404, 'NOT_FOUND');
  next(err);
};

// Rate limiting error handler
const handleRateLimitError = (req, res) => {
  res.status(429).json({
    success: false,
    error: 'Too many requests from this IP, please try again later',
    code: 'RATE_LIMIT_EXCEEDED'
  });
};

// File upload error handler
const handleMulterError = (err, req, res, next) => {
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({
      success: false,
      error: 'File too large',
      code: 'FILE_TOO_LARGE'
    });
  }
  
  if (err.code === 'LIMIT_FILE_COUNT') {
    return res.status(400).json({
      success: false,
      error: 'Too many files',
      code: 'TOO_MANY_FILES'
    });
  }
  
  if (err.code === 'LIMIT_UNEXPECTED_FILE') {
    return res.status(400).json({
      success: false,
      error: 'Unexpected file field',
      code: 'UNEXPECTED_FILE'
    });
  }
  
  next(err);
};

// Success response helper
const sendSuccess = (res, data, message = 'Success', statusCode = 200) => {
  res.status(statusCode).json({
    success: true,
    message,
    data
  });
};

// Paginated response helper
const sendPaginatedResponse = (res, data, pagination, message = 'Success') => {
  res.status(200).json({
    success: true,
    message,
    data,
    pagination
  });
};

module.exports = {
  AppError,
  globalErrorHandler,
  catchAsync,
  handleNotFound,
  handleRateLimitError,
  handleMulterError,
  sendSuccess,
  sendPaginatedResponse
};
