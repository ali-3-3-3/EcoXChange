const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

// Backend configuration
const CONFIG = {
  SERVER: {
    PORT: parseInt(process.env.PORT) || 5000,
    NODE_ENV: process.env.NODE_ENV || 'development',
    CORS_ORIGIN: process.env.CORS_ORIGIN || 'http://localhost:3000',
  },
  DATABASE: {
    HOST: process.env.DB_HOST || 'localhost',
    PORT: parseInt(process.env.DB_PORT) || 5432,
    NAME: process.env.DB_NAME || 'ecoxchange_dev',
    USER: process.env.DB_USER || 'postgres',
    PASSWORD: process.env.DB_PASSWORD || 'password',
    FORCE_SYNC: process.env.DB_FORCE_SYNC === 'true',
  },
  JWT: {
    SECRET: process.env.JWT_SECRET || 'ecoxchange_super_secret_jwt_key_development_only',
    EXPIRES_IN: process.env.JWT_EXPIRES_IN || '7d',
  },
  BLOCKCHAIN: {
    NETWORK: process.env.ETHEREUM_NETWORK || 'development',
    RPC_URL: process.env.ETHEREUM_RPC_URL || 'http://127.0.0.1:8545',
    PRIVATE_KEY: process.env.PRIVATE_KEY || '',
  },
  CONTRACTS: {
    ECOXCHANGE_TOKEN: process.env.ECOXCHANGE_TOKEN_ADDRESS || '',
    ECOXCHANGE_MARKET: process.env.ECOXCHANGE_MARKET_ADDRESS || '',
    VALIDATOR_REGISTRY: process.env.VALIDATOR_REGISTRY_ADDRESS || '',
    COMPANY: process.env.COMPANY_ADDRESS || '',
    DYNAMIC_PRICING: process.env.DYNAMIC_PRICING_ADDRESS || '',
  },
  IPFS: {
    HOST: process.env.IPFS_HOST || 'localhost',
    PORT: parseInt(process.env.IPFS_PORT) || 5001,
    PROTOCOL: process.env.IPFS_PROTOCOL || 'http',
  },
  RATE_LIMITING: {
    WINDOW_MS: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
    MAX_REQUESTS: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
  },
  FILE_UPLOAD: {
    MAX_SIZE: parseInt(process.env.MAX_FILE_SIZE) || 10485760, // 10MB
    UPLOAD_PATH: process.env.UPLOAD_PATH || './uploads',
  }
};

// Validation functions
const validateDatabaseConfig = () => {
  const issues = [];
  
  if (!CONFIG.DATABASE.HOST) issues.push('Database host not configured');
  if (!CONFIG.DATABASE.NAME) issues.push('Database name not configured');
  if (!CONFIG.DATABASE.USER) issues.push('Database user not configured');
  
  return {
    valid: issues.length === 0,
    issues
  };
};

const validateBlockchainConfig = () => {
  const issues = [];
  
  if (!CONFIG.BLOCKCHAIN.RPC_URL) issues.push('Blockchain RPC URL not configured');
  
  // In production, require private key
  if (CONFIG.SERVER.NODE_ENV === 'production' && !CONFIG.BLOCKCHAIN.PRIVATE_KEY) {
    issues.push('Private key required in production');
  }
  
  return {
    valid: issues.length === 0,
    issues
  };
};

const validateJWTConfig = () => {
  const issues = [];
  
  if (!CONFIG.JWT.SECRET || CONFIG.JWT.SECRET === 'ecoxchange_super_secret_jwt_key_development_only') {
    if (CONFIG.SERVER.NODE_ENV === 'production') {
      issues.push('JWT secret must be changed in production');
    }
  }
  
  return {
    valid: issues.length === 0,
    issues
  };
};

const validateContractAddresses = () => {
  const addresses = CONFIG.CONTRACTS;
  const missing = [];

  Object.entries(addresses).forEach(([key, value]) => {
    if (!value || value === '') {
      missing.push(key);
    }
  });

  return {
    valid: missing.length === 0,
    missing
  };
};

const validateEnvironment = () => {
  const allIssues = [];
  
  const dbValidation = validateDatabaseConfig();
  if (!dbValidation.valid) allIssues.push(...dbValidation.issues);
  
  const blockchainValidation = validateBlockchainConfig();
  if (!blockchainValidation.valid) allIssues.push(...blockchainValidation.issues);
  
  const jwtValidation = validateJWTConfig();
  if (!jwtValidation.valid) allIssues.push(...jwtValidation.issues);
  
  // Contract addresses are optional in development
  if (CONFIG.SERVER.NODE_ENV === 'production') {
    const contractValidation = validateContractAddresses();
    if (!contractValidation.valid) {
      allIssues.push(`Missing contract addresses: ${contractValidation.missing.join(', ')}`);
    }
  }
  
  return {
    valid: allIssues.length === 0,
    issues: allIssues
  };
};

// Log configuration status
const logConfigStatus = () => {
  console.log('📋 Configuration Status:');
  console.log(`   Environment: ${CONFIG.SERVER.NODE_ENV}`);
  console.log(`   Port: ${CONFIG.SERVER.PORT}`);
  console.log(`   Database: ${CONFIG.DATABASE.HOST}:${CONFIG.DATABASE.PORT}/${CONFIG.DATABASE.NAME}`);
  console.log(`   Blockchain: ${CONFIG.BLOCKCHAIN.NETWORK} (${CONFIG.BLOCKCHAIN.RPC_URL})`);
  
  const validation = validateEnvironment();
  if (validation.valid) {
    console.log('✅ All configuration valid');
  } else {
    console.log('⚠️  Configuration issues:');
    validation.issues.forEach(issue => console.log(`   - ${issue}`));
  }
};

module.exports = {
  CONFIG,
  validateDatabaseConfig,
  validateBlockchainConfig,
  validateJWTConfig,
  validateContractAddresses,
  validateEnvironment,
  logConfigStatus
};
