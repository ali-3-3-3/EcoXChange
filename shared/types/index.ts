// User Types
export interface User {
  id: string;
  walletAddress: string;
  email?: string;
  name?: string;
  role: UserRole;
  isValidator: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export enum UserRole {
  BUYER = 'buyer',
  SELLER = 'seller',
  VALIDATOR = 'validator',
  ADMIN = 'admin'
}

// Project Types
export interface Project {
  id: string;
  companyId: string;
  title: string;
  description: string;
  location: string;
  projectType: ProjectType;
  excAmount: number;
  excListed: number;
  excSold: number;
  stakedCredits: number;
  state: ProjectState;
  validationStatus: ValidationStatus;
  documents: ProjectDocument[];
  createdAt: Date;
  updatedAt: Date;
}

export enum ProjectType {
  REFORESTATION = 'reforestation',
  RENEWABLE_ENERGY = 'renewable_energy',
  ENERGY_EFFICIENCY = 'energy_efficiency',
  WASTE_MANAGEMENT = 'waste_management',
  CARBON_CAPTURE = 'carbon_capture',
  OTHER = 'other'
}

export enum ProjectState {
  DRAFT = 'draft',
  SUBMITTED = 'submitted',
  UNDER_REVIEW = 'under_review',
  ONGOING = 'ongoing',
  COMPLETED = 'completed',
  REJECTED = 'rejected'
}

export enum ValidationStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
  REQUIRES_CHANGES = 'requires_changes'
}

export interface ProjectDocument {
  id: string;
  projectId: string;
  name: string;
  type: DocumentType;
  ipfsHash: string;
  uploadedAt: Date;
}

export enum DocumentType {
  PROJECT_PLAN = 'project_plan',
  ENVIRONMENTAL_IMPACT = 'environmental_impact',
  VERIFICATION_REPORT = 'verification_report',
  FINANCIAL_STATEMENT = 'financial_statement',
  CERTIFICATION = 'certification',
  OTHER = 'other'
}

// Transaction Types
export interface Transaction {
  id: string;
  type: TransactionType;
  buyerAddress?: string;
  sellerAddress?: string;
  projectId: string;
  amount: number;
  pricePerCredit: number;
  totalPrice: number;
  txHash: string;
  status: TransactionStatus;
  createdAt: Date;
  confirmedAt?: Date;
}

export enum TransactionType {
  BUY = 'buy',
  SELL = 'sell',
  TRANSFER = 'transfer',
  BURN = 'burn'
}

export enum TransactionStatus {
  PENDING = 'pending',
  CONFIRMED = 'confirmed',
  FAILED = 'failed',
  CANCELLED = 'cancelled'
}

// Company Types
export interface Company {
  id: string;
  name: string;
  description?: string;
  website?: string;
  walletAddress: string;
  projects: Project[];
  createdAt: Date;
  updatedAt: Date;
}

// Validator Types
export interface Validator {
  id: string;
  walletAddress: string;
  name: string;
  credentials: string;
  specializations: ProjectType[];
  isActive: boolean;
  validatedProjects: number;
  createdAt: Date;
  updatedAt: Date;
}

// API Response Types
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T = any> extends ApiResponse<T[]> {
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// Blockchain Types
export interface ContractAddresses {
  ecoXChangeToken: string;
  ecoXChangeMarket: string;
  validatorRegistry: string;
  company: string;
}

export interface Web3State {
  isConnected: boolean;
  account: string | null;
  chainId: number | null;
  balance: string;
  tokenBalance: string;
}

// Form Types
export interface CreateProjectForm {
  title: string;
  description: string;
  location: string;
  projectType: ProjectType;
  excAmount: number;
  documents: File[];
}

export interface BuyCreditsForm {
  projectId: string;
  amount: number;
  maxPricePerCredit: number;
}

export interface SellCreditsForm {
  projectId: string;
  amount: number;
  pricePerCredit: number;
}
