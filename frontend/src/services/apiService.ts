import { API_ENDPOINTS } from '../../../shared/constants';
import type { 
  ApiResponse, 
  PaginatedResponse, 
  User, 
  Company, 
  Project, 
  Transaction, 
  Validator 
} from '../../../shared/types';

interface RequestConfig {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  headers?: Record<string, string>;
  body?: any;
  timeout?: number;
}

class ApiService {
  private baseURL: string;
  private timeout: number;
  private authToken: string | null = null;

  constructor() {
    this.baseURL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
    this.timeout = parseInt(process.env.NEXT_PUBLIC_API_TIMEOUT || '10000');
  }

  setAuthToken(token: string | null): void {
    this.authToken = token;
    if (typeof window !== 'undefined') {
      if (token) {
        localStorage.setItem('auth_token', token);
      } else {
        localStorage.removeItem('auth_token');
      }
    }
  }

  getAuthToken(): string | null {
    if (this.authToken) return this.authToken;
    
    if (typeof window !== 'undefined') {
      return localStorage.getItem('auth_token');
    }
    
    return null;
  }

  private async request<T>(endpoint: string, config: RequestConfig = {}): Promise<T> {
    const url = `${this.baseURL}${endpoint}`;
    const token = this.getAuthToken();

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...config.headers
    };

    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    const requestConfig: RequestInit = {
      method: config.method || 'GET',
      headers,
      ...config.body && { body: JSON.stringify(config.body) }
    };

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), config.timeout || this.timeout);

      const response = await fetch(url, {
        ...requestConfig,
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }

      return await response.json();
    } catch (error: any) {
      if (error.name === 'AbortError') {
        throw new Error('Request timeout');
      }
      throw error;
    }
  }

  // Authentication endpoints
  async login(walletAddress: string, signature: string, message: string): Promise<ApiResponse<{ user: User; token: string }>> {
    return this.request(API_ENDPOINTS.AUTH.LOGIN, {
      method: 'POST',
      body: { walletAddress, signature, message }
    });
  }

  async logout(): Promise<ApiResponse> {
    const result = await this.request(API_ENDPOINTS.AUTH.LOGOUT, {
      method: 'POST'
    });
    this.setAuthToken(null);
    return result;
  }

  async getProfile(): Promise<ApiResponse<User>> {
    return this.request(API_ENDPOINTS.AUTH.PROFILE);
  }

  // User endpoints
  async getUsers(params?: { page?: number; limit?: number; role?: string }): Promise<PaginatedResponse<User>> {
    const searchParams = new URLSearchParams();
    if (params?.page) searchParams.append('page', params.page.toString());
    if (params?.limit) searchParams.append('limit', params.limit.toString());
    if (params?.role) searchParams.append('role', params.role);

    const endpoint = `${API_ENDPOINTS.USERS.BASE}?${searchParams.toString()}`;
    return this.request(endpoint);
  }

  async getUser(id: string): Promise<ApiResponse<User>> {
    return this.request(API_ENDPOINTS.USERS.BY_ID(id));
  }

  async updateUser(id: string, data: Partial<User>): Promise<ApiResponse<User>> {
    return this.request(API_ENDPOINTS.USERS.BY_ID(id), {
      method: 'PUT',
      body: data
    });
  }

  // Company endpoints
  async getCompanies(params?: { page?: number; limit?: number }): Promise<PaginatedResponse<Company>> {
    const searchParams = new URLSearchParams();
    if (params?.page) searchParams.append('page', params.page.toString());
    if (params?.limit) searchParams.append('limit', params.limit.toString());

    const endpoint = `${API_ENDPOINTS.PROJECTS.BASE.replace('/projects', '/companies')}?${searchParams.toString()}`;
    return this.request(endpoint);
  }

  async registerCompany(data: {
    name: string;
    description?: string;
    website?: string;
    walletAddress: string;
  }): Promise<ApiResponse<Company>> {
    return this.request('/api/companies', {
      method: 'POST',
      body: data
    });
  }

  async getCompany(id: string): Promise<ApiResponse<Company>> {
    return this.request(`/api/companies/${id}`);
  }

  // Project endpoints
  async getProjects(params?: { 
    page?: number; 
    limit?: number; 
    type?: string; 
    status?: string;
    companyId?: string;
  }): Promise<PaginatedResponse<Project>> {
    const searchParams = new URLSearchParams();
    if (params?.page) searchParams.append('page', params.page.toString());
    if (params?.limit) searchParams.append('limit', params.limit.toString());
    if (params?.type) searchParams.append('type', params.type);
    if (params?.status) searchParams.append('status', params.status);
    if (params?.companyId) searchParams.append('companyId', params.companyId);

    const endpoint = `${API_ENDPOINTS.PROJECTS.BASE}?${searchParams.toString()}`;
    return this.request(endpoint);
  }

  async createProject(data: {
    title: string;
    description: string;
    location: string;
    projectType: string;
    excAmount: number;
    carbonDioxideSaved: number;
    daysTillCompletion?: number;
  }): Promise<ApiResponse<Project>> {
    return this.request(API_ENDPOINTS.PROJECTS.BASE, {
      method: 'POST',
      body: data
    });
  }

  async getProject(id: string): Promise<ApiResponse<Project>> {
    return this.request(API_ENDPOINTS.PROJECTS.BY_ID(id));
  }

  async updateProject(id: string, data: Partial<Project>): Promise<ApiResponse<Project>> {
    return this.request(API_ENDPOINTS.PROJECTS.BY_ID(id), {
      method: 'PUT',
      body: data
    });
  }

  async deleteProject(id: string): Promise<ApiResponse> {
    return this.request(API_ENDPOINTS.PROJECTS.BY_ID(id), {
      method: 'DELETE'
    });
  }

  // Transaction endpoints
  async getTransactions(params?: { 
    page?: number; 
    limit?: number; 
    type?: string;
    status?: string;
    walletAddress?: string;
  }): Promise<PaginatedResponse<Transaction>> {
    const searchParams = new URLSearchParams();
    if (params?.page) searchParams.append('page', params.page.toString());
    if (params?.limit) searchParams.append('limit', params.limit.toString());
    if (params?.type) searchParams.append('type', params.type);
    if (params?.status) searchParams.append('status', params.status);
    if (params?.walletAddress) searchParams.append('walletAddress', params.walletAddress);

    const endpoint = `${API_ENDPOINTS.TRANSACTIONS.BASE}?${searchParams.toString()}`;
    return this.request(endpoint);
  }

  async buyCredits(data: {
    projectId: string;
    amount: number;
    maxPricePerCredit: number;
    companyAddress: string;
  }): Promise<ApiResponse<Transaction>> {
    return this.request(API_ENDPOINTS.TRANSACTIONS.BUY, {
      method: 'POST',
      body: data
    });
  }

  async sellCredits(data: {
    projectId: string;
    amount: number;
    pricePerCredit: number;
  }): Promise<ApiResponse<Transaction>> {
    return this.request(API_ENDPOINTS.TRANSACTIONS.SELL, {
      method: 'POST',
      body: data
    });
  }

  async getTransaction(id: string): Promise<ApiResponse<Transaction>> {
    return this.request(API_ENDPOINTS.TRANSACTIONS.BY_ID(id));
  }

  // Validator endpoints
  async getValidators(params?: { page?: number; limit?: number }): Promise<PaginatedResponse<Validator>> {
    const searchParams = new URLSearchParams();
    if (params?.page) searchParams.append('page', params.page.toString());
    if (params?.limit) searchParams.append('limit', params.limit.toString());

    const endpoint = `${API_ENDPOINTS.VALIDATORS.BASE}?${searchParams.toString()}`;
    return this.request(endpoint);
  }

  async registerValidator(data: {
    name: string;
    credentials: string;
    specializations: string[];
  }): Promise<ApiResponse<Validator>> {
    return this.request(API_ENDPOINTS.VALIDATORS.BASE, {
      method: 'POST',
      body: data
    });
  }

  async validateProject(data: {
    companyAddress: string;
    projectId: number;
    isValid: boolean;
    actualEXC: number;
  }): Promise<ApiResponse> {
    return this.request(API_ENDPOINTS.VALIDATORS.VALIDATE, {
      method: 'POST',
      body: data
    });
  }

  async getPendingValidations(): Promise<ApiResponse<Project[]>> {
    return this.request(API_ENDPOINTS.VALIDATORS.PENDING);
  }

  // File upload
  async uploadFile(file: File, projectId: string, documentType: string): Promise<ApiResponse<{ ipfsHash: string; url: string }>> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('projectId', projectId);
    formData.append('type', documentType);

    return this.request(`/api/upload`, {
      method: 'POST',
      headers: {}, // Don't set Content-Type for FormData
      body: formData
    });
  }

  // Health check
  async healthCheck(): Promise<{ status: string; timestamp: string }> {
    return this.request('/health');
  }
}

// Create singleton instance
export const apiService = new ApiService();
export default apiService;
