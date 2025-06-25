// Re-export shared constants and types for frontend use
export * from '../../../shared/constants';
export * from '../../../shared/types';

// Frontend-specific configuration
export const FRONTEND_CONFIG = {
  API: {
    BASE_URL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000',
    TIMEOUT: parseInt(process.env.NEXT_PUBLIC_API_TIMEOUT || '10000'),
  },
  BLOCKCHAIN: {
    NETWORK: process.env.NEXT_PUBLIC_ETHEREUM_NETWORK || 'development',
    RPC_URL: process.env.NEXT_PUBLIC_ETHEREUM_RPC_URL || 'http://127.0.0.1:8545',
    CHAIN_ID: parseInt(process.env.NEXT_PUBLIC_CHAIN_ID || '1337'),
  },
  CONTRACTS: {
    ECOXCHANGE_TOKEN: process.env.NEXT_PUBLIC_ECOXCHANGE_TOKEN_ADDRESS || '',
    ECOXCHANGE_MARKET: process.env.NEXT_PUBLIC_ECOXCHANGE_MARKET_ADDRESS || '',
    VALIDATOR_REGISTRY: process.env.NEXT_PUBLIC_VALIDATOR_REGISTRY_ADDRESS || '',
    COMPANY: process.env.NEXT_PUBLIC_COMPANY_ADDRESS || '',
    DYNAMIC_PRICING: process.env.NEXT_PUBLIC_DYNAMIC_PRICING_ADDRESS || '',
  },
  IPFS: {
    GATEWAY: process.env.NEXT_PUBLIC_IPFS_GATEWAY || 'https://ipfs.io/ipfs/',
    API_URL: process.env.NEXT_PUBLIC_IPFS_API_URL || 'http://localhost:5001',
  },
  FEATURES: {
    DYNAMIC_PRICING: process.env.NEXT_PUBLIC_ENABLE_DYNAMIC_PRICING === 'true',
    NOTIFICATIONS: process.env.NEXT_PUBLIC_ENABLE_NOTIFICATIONS === 'true',
    ANALYTICS: process.env.NEXT_PUBLIC_ENABLE_ANALYTICS === 'true',
  },
  DEBUG: {
    ENABLED: process.env.NEXT_PUBLIC_DEBUG_MODE === 'true',
    CONSOLE_LOGS: process.env.NEXT_PUBLIC_SHOW_CONSOLE_LOGS === 'true',
  }
} as const;

// Network configurations
export const SUPPORTED_NETWORKS = {
  1: {
    name: 'Ethereum Mainnet',
    rpcUrl: 'https://mainnet.infura.io/v3/',
    blockExplorer: 'https://etherscan.io',
    nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 }
  },
  5: {
    name: 'Goerli Testnet',
    rpcUrl: 'https://goerli.infura.io/v3/',
    blockExplorer: 'https://goerli.etherscan.io',
    nativeCurrency: { name: 'Goerli Ether', symbol: 'ETH', decimals: 18 }
  },
  11155111: {
    name: 'Sepolia Testnet',
    rpcUrl: 'https://sepolia.infura.io/v3/',
    blockExplorer: 'https://sepolia.etherscan.io',
    nativeCurrency: { name: 'Sepolia Ether', symbol: 'ETH', decimals: 18 }
  },
  1337: {
    name: 'Localhost',
    rpcUrl: 'http://127.0.0.1:8545',
    blockExplorer: '',
    nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 }
  }
} as const;

// Validation helpers
export const isValidNetwork = (chainId: number): boolean => {
  return chainId in SUPPORTED_NETWORKS;
};

export const getNetworkConfig = (chainId: number) => {
  return SUPPORTED_NETWORKS[chainId as keyof typeof SUPPORTED_NETWORKS];
};

// Contract address validation
export const validateContractAddresses = (): { valid: boolean; missing: string[] } => {
  const addresses = FRONTEND_CONFIG.CONTRACTS;
  const missing: string[] = [];

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

// Environment validation
export const validateEnvironment = (): { valid: boolean; issues: string[] } => {
  const issues: string[] = [];

  // Check required environment variables
  if (!FRONTEND_CONFIG.API.BASE_URL) {
    issues.push('API base URL not configured');
  }

  if (!FRONTEND_CONFIG.BLOCKCHAIN.RPC_URL) {
    issues.push('Blockchain RPC URL not configured');
  }

  // Check contract addresses in production
  if (process.env.NODE_ENV === 'production') {
    const contractValidation = validateContractAddresses();
    if (!contractValidation.valid) {
      issues.push(`Missing contract addresses: ${contractValidation.missing.join(', ')}`);
    }
  }

  return {
    valid: issues.length === 0,
    issues
  };
};
