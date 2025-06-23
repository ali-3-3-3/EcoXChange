// API Endpoints
export const API_ENDPOINTS = {
  AUTH: {
    LOGIN: '/api/auth/login',
    LOGOUT: '/api/auth/logout',
    PROFILE: '/api/auth/profile',
  },
  USERS: {
    BASE: '/api/users',
    BY_ID: (id: string) => `/api/users/${id}`,
  },
  PROJECTS: {
    BASE: '/api/projects',
    BY_ID: (id: string) => `/api/projects/${id}`,
    DOCUMENTS: (id: string) => `/api/projects/${id}/documents`,
  },
  TRANSACTIONS: {
    BASE: '/api/transactions',
    BUY: '/api/transactions/buy',
    SELL: '/api/transactions/sell',
    BY_ID: (id: string) => `/api/transactions/${id}`,
  },
  VALIDATORS: {
    BASE: '/api/validators',
    VALIDATE: '/api/validators/validate',
    PENDING: '/api/validators/pending',
  },
} as const;

// Blockchain Constants
export const BLOCKCHAIN_CONFIG = {
  NETWORKS: {
    MAINNET: {
      chainId: 1,
      name: 'Ethereum Mainnet',
      rpcUrl: 'https://mainnet.infura.io/v3/',
      blockExplorer: 'https://etherscan.io',
    },
    GOERLI: {
      chainId: 5,
      name: 'Goerli Testnet',
      rpcUrl: 'https://goerli.infura.io/v3/',
      blockExplorer: 'https://goerli.etherscan.io',
    },
    SEPOLIA: {
      chainId: 11155111,
      name: 'Sepolia Testnet',
      rpcUrl: 'https://sepolia.infura.io/v3/',
      blockExplorer: 'https://sepolia.etherscan.io',
    },
    LOCALHOST: {
      chainId: 1337,
      name: 'Localhost',
      rpcUrl: 'http://127.0.0.1:8545',
      blockExplorer: '',
    },
  },
  GAS_LIMITS: {
    TRANSFER: 21000,
    CONTRACT_INTERACTION: 200000,
    TOKEN_TRANSFER: 65000,
    COMPLEX_TRANSACTION: 500000,
  },
} as const;

// Application Constants
export const APP_CONFIG = {
  NAME: 'EcoXChange',
  DESCRIPTION: 'Carbon Credit Trading Platform',
  VERSION: '1.0.0',
  SUPPORT_EMAIL: 'support@ecoxchange.com',
  DOCS_URL: 'https://docs.ecoxchange.com',
} as const;

// UI Constants
export const UI_CONFIG = {
  PAGINATION: {
    DEFAULT_PAGE_SIZE: 10,
    MAX_PAGE_SIZE: 100,
  },
  DEBOUNCE_DELAY: 300,
  TOAST_DURATION: 5000,
  MODAL_ANIMATION_DURATION: 200,
} as const;

// Validation Constants
export const VALIDATION_RULES = {
  PROJECT: {
    TITLE_MIN_LENGTH: 3,
    TITLE_MAX_LENGTH: 100,
    DESCRIPTION_MIN_LENGTH: 10,
    DESCRIPTION_MAX_LENGTH: 1000,
    MIN_EXC_AMOUNT: 1,
    MAX_EXC_AMOUNT: 1000000,
  },
  USER: {
    NAME_MIN_LENGTH: 2,
    NAME_MAX_LENGTH: 50,
    EMAIL_REGEX: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  },
  TRANSACTION: {
    MIN_AMOUNT: 0.01,
    MAX_AMOUNT: 100000,
    MIN_PRICE: 0.01,
    MAX_PRICE: 1000,
  },
} as const;

// File Upload Constants
export const FILE_CONFIG = {
  MAX_SIZE: 10 * 1024 * 1024, // 10MB
  ALLOWED_TYPES: [
    'application/pdf',
    'image/jpeg',
    'image/png',
    'image/gif',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  ],
  ALLOWED_EXTENSIONS: ['.pdf', '.jpg', '.jpeg', '.png', '.gif', '.doc', '.docx', '.xls', '.xlsx'],
} as const;

// Error Messages
export const ERROR_MESSAGES = {
  NETWORK: {
    CONNECTION_FAILED: 'Failed to connect to the network',
    TRANSACTION_FAILED: 'Transaction failed',
    INSUFFICIENT_FUNDS: 'Insufficient funds',
    USER_REJECTED: 'Transaction rejected by user',
  },
  VALIDATION: {
    REQUIRED_FIELD: 'This field is required',
    INVALID_EMAIL: 'Please enter a valid email address',
    INVALID_WALLET_ADDRESS: 'Please enter a valid wallet address',
    MIN_LENGTH: (min: number) => `Minimum length is ${min} characters`,
    MAX_LENGTH: (max: number) => `Maximum length is ${max} characters`,
    MIN_VALUE: (min: number) => `Minimum value is ${min}`,
    MAX_VALUE: (max: number) => `Maximum value is ${max}`,
  },
  AUTH: {
    UNAUTHORIZED: 'You are not authorized to perform this action',
    SESSION_EXPIRED: 'Your session has expired. Please log in again',
    INVALID_CREDENTIALS: 'Invalid credentials',
  },
  GENERAL: {
    SOMETHING_WENT_WRONG: 'Something went wrong. Please try again',
    NOT_FOUND: 'Resource not found',
    SERVER_ERROR: 'Server error. Please try again later',
  },
} as const;

// Success Messages
export const SUCCESS_MESSAGES = {
  PROJECT: {
    CREATED: 'Project created successfully',
    UPDATED: 'Project updated successfully',
    DELETED: 'Project deleted successfully',
    SUBMITTED: 'Project submitted for validation',
  },
  TRANSACTION: {
    INITIATED: 'Transaction initiated successfully',
    CONFIRMED: 'Transaction confirmed',
    COMPLETED: 'Transaction completed successfully',
  },
  AUTH: {
    LOGIN_SUCCESS: 'Logged in successfully',
    LOGOUT_SUCCESS: 'Logged out successfully',
  },
  GENERAL: {
    SAVED: 'Changes saved successfully',
    UPLOADED: 'File uploaded successfully',
    COPIED: 'Copied to clipboard',
  },
} as const;

// Project Type Labels
export const PROJECT_TYPE_LABELS = {
  reforestation: 'Reforestation',
  renewable_energy: 'Renewable Energy',
  energy_efficiency: 'Energy Efficiency',
  waste_management: 'Waste Management',
  carbon_capture: 'Carbon Capture',
  other: 'Other',
} as const;

// Status Labels
export const STATUS_LABELS = {
  PROJECT_STATE: {
    draft: 'Draft',
    submitted: 'Submitted',
    under_review: 'Under Review',
    ongoing: 'Ongoing',
    completed: 'Completed',
    rejected: 'Rejected',
  },
  VALIDATION_STATUS: {
    pending: 'Pending',
    approved: 'Approved',
    rejected: 'Rejected',
    requires_changes: 'Requires Changes',
  },
  TRANSACTION_STATUS: {
    pending: 'Pending',
    confirmed: 'Confirmed',
    failed: 'Failed',
    cancelled: 'Cancelled',
  },
} as const;

// Color Schemes for Status
export const STATUS_COLORS = {
  PROJECT_STATE: {
    draft: 'gray',
    submitted: 'blue',
    under_review: 'yellow',
    ongoing: 'green',
    completed: 'emerald',
    rejected: 'red',
  },
  VALIDATION_STATUS: {
    pending: 'yellow',
    approved: 'green',
    rejected: 'red',
    requires_changes: 'orange',
  },
  TRANSACTION_STATUS: {
    pending: 'yellow',
    confirmed: 'green',
    failed: 'red',
    cancelled: 'gray',
  },
} as const;
