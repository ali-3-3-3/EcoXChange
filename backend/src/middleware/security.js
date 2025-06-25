const rateLimit = require('express-rate-limit');
const { AppError } = require('./errorHandler');

// Rate limiting configurations
const createRateLimit = (windowMs, max, message, skipSuccessfulRequests = false) => {
  return rateLimit({
    windowMs,
    max,
    message: {
      success: false,
      error: message,
      code: 'RATE_LIMIT_EXCEEDED'
    },
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests,
    handler: (req, res) => {
      res.status(429).json({
        success: false,
        error: message,
        code: 'RATE_LIMIT_EXCEEDED'
      });
    }
  });
};

// General API rate limiting
const generalLimiter = createRateLimit(
  15 * 60 * 1000, // 15 minutes
  100, // limit each IP to 100 requests per windowMs
  'Too many requests from this IP, please try again later'
);

// Strict rate limiting for authentication endpoints
const authLimiter = createRateLimit(
  15 * 60 * 1000, // 15 minutes
  5, // limit each IP to 5 requests per windowMs
  'Too many authentication attempts, please try again later'
);

// Rate limiting for transaction endpoints
const transactionLimiter = createRateLimit(
  60 * 1000, // 1 minute
  10, // limit each IP to 10 transactions per minute
  'Too many transaction requests, please slow down'
);

// Rate limiting for file uploads
const uploadLimiter = createRateLimit(
  60 * 60 * 1000, // 1 hour
  20, // limit each IP to 20 uploads per hour
  'Too many file uploads, please try again later'
);

// Wallet address validation middleware
const validateWalletAddress = (req, res, next) => {
  const walletAddress = req.body.walletAddress || req.params.walletAddress;
  
  if (walletAddress && !/^0x[a-fA-F0-9]{40}$/.test(walletAddress)) {
    return next(new AppError('Invalid Ethereum wallet address format', 400, 'INVALID_WALLET_ADDRESS'));
  }
  
  next();
};

// Sanitize input middleware
const sanitizeInput = (req, res, next) => {
  // Remove any potential XSS attempts
  const sanitizeString = (str) => {
    if (typeof str !== 'string') return str;
    return str
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
      .replace(/javascript:/gi, '')
      .replace(/on\w+\s*=/gi, '');
  };

  const sanitizeObject = (obj) => {
    if (obj === null || typeof obj !== 'object') {
      return typeof obj === 'string' ? sanitizeString(obj) : obj;
    }

    if (Array.isArray(obj)) {
      return obj.map(sanitizeObject);
    }

    const sanitized = {};
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        sanitized[key] = sanitizeObject(obj[key]);
      }
    }
    return sanitized;
  };

  req.body = sanitizeObject(req.body);
  req.query = sanitizeObject(req.query);
  req.params = sanitizeObject(req.params);

  next();
};

// Check for suspicious patterns
const detectSuspiciousActivity = (req, res, next) => {
  const suspiciousPatterns = [
    /(\.\.|\/etc\/|\/proc\/|\/sys\/)/i, // Path traversal
    /(union|select|insert|update|delete|drop|create|alter)/i, // SQL injection
    /(<script|javascript:|vbscript:|onload|onerror)/i, // XSS
    /(eval\(|setTimeout\(|setInterval\()/i, // Code injection
  ];

  const checkString = (str) => {
    if (typeof str !== 'string') return false;
    return suspiciousPatterns.some(pattern => pattern.test(str));
  };

  const checkObject = (obj) => {
    if (obj === null || typeof obj !== 'object') {
      return checkString(obj);
    }

    if (Array.isArray(obj)) {
      return obj.some(checkObject);
    }

    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        if (checkString(key) || checkObject(obj[key])) {
          return true;
        }
      }
    }
    return false;
  };

  if (checkObject(req.body) || checkObject(req.query) || checkObject(req.params)) {
    console.warn(`Suspicious activity detected from IP: ${req.ip}, URL: ${req.originalUrl}`);
    return next(new AppError('Suspicious activity detected', 400, 'SUSPICIOUS_ACTIVITY'));
  }

  next();
};

// IP whitelist middleware (for admin endpoints)
const ipWhitelist = (allowedIPs = []) => {
  return (req, res, next) => {
    const clientIP = req.ip || req.connection.remoteAddress;
    
    if (allowedIPs.length > 0 && !allowedIPs.includes(clientIP)) {
      console.warn(`Unauthorized IP access attempt: ${clientIP}`);
      return next(new AppError('Access denied from this IP address', 403, 'IP_NOT_ALLOWED'));
    }
    
    next();
  };
};

// Request size limiter
const requestSizeLimiter = (maxSize = '10mb') => {
  return (req, res, next) => {
    const contentLength = parseInt(req.headers['content-length']);
    const maxSizeBytes = typeof maxSize === 'string' 
      ? parseInt(maxSize) * (maxSize.includes('mb') ? 1024 * 1024 : 1024)
      : maxSize;

    if (contentLength > maxSizeBytes) {
      return next(new AppError('Request entity too large', 413, 'REQUEST_TOO_LARGE'));
    }

    next();
  };
};

// CORS security headers
const securityHeaders = (req, res, next) => {
  // Prevent clickjacking
  res.setHeader('X-Frame-Options', 'DENY');
  
  // Prevent MIME type sniffing
  res.setHeader('X-Content-Type-Options', 'nosniff');
  
  // Enable XSS protection
  res.setHeader('X-XSS-Protection', '1; mode=block');
  
  // Referrer policy
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  
  // Content Security Policy
  res.setHeader('Content-Security-Policy', 
    "default-src 'self'; " +
    "script-src 'self' 'unsafe-inline'; " +
    "style-src 'self' 'unsafe-inline'; " +
    "img-src 'self' data: https:; " +
    "connect-src 'self' ws: wss: https:; " +
    "font-src 'self' data:; " +
    "object-src 'none'; " +
    "base-uri 'self'; " +
    "form-action 'self';"
  );

  next();
};

// API key validation (for external integrations)
const validateApiKey = (req, res, next) => {
  const apiKey = req.headers['x-api-key'];
  
  if (!apiKey) {
    return next(new AppError('API key required', 401, 'API_KEY_REQUIRED'));
  }

  // In production, validate against database or environment variable
  const validApiKeys = process.env.VALID_API_KEYS ? process.env.VALID_API_KEYS.split(',') : [];
  
  if (validApiKeys.length > 0 && !validApiKeys.includes(apiKey)) {
    return next(new AppError('Invalid API key', 401, 'INVALID_API_KEY'));
  }

  next();
};

// Blockchain transaction security
const validateTransactionSecurity = (req, res, next) => {
  const { amount, price_per_credit } = req.body;
  
  // Check for unreasonable amounts
  if (amount && (amount > 1000000 || amount < 0.01)) {
    return next(new AppError('Transaction amount out of reasonable range', 400, 'INVALID_AMOUNT'));
  }
  
  // Check for unreasonable prices
  if (price_per_credit && (price_per_credit > 1000 || price_per_credit < 0.01)) {
    return next(new AppError('Price per credit out of reasonable range', 400, 'INVALID_PRICE'));
  }
  
  next();
};

module.exports = {
  generalLimiter,
  authLimiter,
  transactionLimiter,
  uploadLimiter,
  validateWalletAddress,
  sanitizeInput,
  detectSuspiciousActivity,
  ipWhitelist,
  requestSizeLimiter,
  securityHeaders,
  validateApiKey,
  validateTransactionSecurity
};
