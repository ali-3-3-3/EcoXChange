const jwt = require('jsonwebtoken');
const { User } = require('../models');
const { ethers } = require('ethers');

// Generate JWT token
const generateToken = (user) => {
  return jwt.sign(
    { 
      id: user.id, 
      walletAddress: user.wallet_address,
      role: user.role 
    },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );
};

// Verify JWT token
const verifyToken = (token) => {
  return jwt.verify(token, process.env.JWT_SECRET);
};

// Middleware to authenticate JWT token
const authenticateToken = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
      return res.status(401).json({
        success: false,
        error: 'Access token required'
      });
    }

    const decoded = verifyToken(token);
    
    // Get user from database
    const user = await User.findByPk(decoded.id);
    if (!user || !user.is_active) {
      return res.status(401).json({
        success: false,
        error: 'Invalid or inactive user'
      });
    }

    // Add user to request object
    req.user = user;
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        error: 'Token expired'
      });
    } else if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        success: false,
        error: 'Invalid token'
      });
    }
    
    console.error('Authentication error:', error);
    return res.status(500).json({
      success: false,
      error: 'Authentication failed'
    });
  }
};

// Middleware to check user roles
const requireRole = (roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required'
      });
    }

    const userRoles = Array.isArray(req.user.role) ? req.user.role : [req.user.role];
    const requiredRoles = Array.isArray(roles) ? roles : [roles];
    
    const hasRole = requiredRoles.some(role => userRoles.includes(role));
    
    if (!hasRole) {
      return res.status(403).json({
        success: false,
        error: 'Insufficient permissions'
      });
    }

    next();
  };
};

// Middleware to verify wallet signature
const verifyWalletSignature = async (req, res, next) => {
  try {
    const { walletAddress, signature, message } = req.body;

    if (!walletAddress || !signature || !message) {
      return res.status(400).json({
        success: false,
        error: 'Wallet address, signature, and message are required'
      });
    }

    // Verify the signature
    const recoveredAddress = ethers.verifyMessage(message, signature);
    
    if (recoveredAddress.toLowerCase() !== walletAddress.toLowerCase()) {
      return res.status(401).json({
        success: false,
        error: 'Invalid signature'
      });
    }

    // Check if message is recent (within 5 minutes)
    const messageData = JSON.parse(message);
    const timestamp = new Date(messageData.timestamp);
    const now = new Date();
    const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000);

    if (timestamp < fiveMinutesAgo) {
      return res.status(401).json({
        success: false,
        error: 'Message expired'
      });
    }

    req.verifiedWallet = walletAddress.toLowerCase();
    next();
  } catch (error) {
    console.error('Wallet signature verification error:', error);
    return res.status(401).json({
      success: false,
      error: 'Signature verification failed'
    });
  }
};

// Middleware to check if user owns the wallet
const requireWalletOwnership = async (req, res, next) => {
  try {
    const walletAddress = req.params.walletAddress || req.body.walletAddress;
    
    if (!walletAddress) {
      return res.status(400).json({
        success: false,
        error: 'Wallet address required'
      });
    }

    if (req.user.wallet_address.toLowerCase() !== walletAddress.toLowerCase()) {
      return res.status(403).json({
        success: false,
        error: 'You can only access your own wallet data'
      });
    }

    next();
  } catch (error) {
    console.error('Wallet ownership check error:', error);
    return res.status(500).json({
      success: false,
      error: 'Wallet ownership verification failed'
    });
  }
};

// Middleware to check if user is a validator
const requireValidator = async (req, res, next) => {
  try {
    if (!req.user.is_validator) {
      return res.status(403).json({
        success: false,
        error: 'Validator access required'
      });
    }

    // Optionally check if validator is active in smart contract
    const { contractService } = require('../services/ContractService');
    const isActiveValidator = await contractService.isValidator(req.user.wallet_address);
    
    if (!isActiveValidator) {
      return res.status(403).json({
        success: false,
        error: 'Validator not active in smart contract'
      });
    }

    next();
  } catch (error) {
    console.error('Validator check error:', error);
    return res.status(500).json({
      success: false,
      error: 'Validator verification failed'
    });
  }
};

// Optional authentication (doesn't fail if no token)
const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (token) {
      const decoded = verifyToken(token);
      const user = await User.findByPk(decoded.id);
      if (user && user.is_active) {
        req.user = user;
      }
    }
    
    next();
  } catch (error) {
    // Ignore authentication errors for optional auth
    next();
  }
};

module.exports = {
  generateToken,
  verifyToken,
  authenticateToken,
  requireRole,
  verifyWalletSignature,
  requireWalletOwnership,
  requireValidator,
  optionalAuth
};
