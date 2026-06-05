// API Response Types
export interface ApiResponse<T = unknown> {
  message?: string;
  success?: boolean;
  data?: T;
  error?: string;
}

export interface ApiSuccessResponse<T = unknown> extends ApiResponse<T> {
  message: string;
  success: true;
  data?: T;
}

export interface ApiErrorResponse extends ApiResponse {
  message: string;
  success: false;
  error?: string;
}

interface CustomFetchOptions extends RequestInit {
  requiresAuth?: boolean; 
}

import config from '../../config/config';

export class BaseApi {
  protected baseUrl: string = config.BACKENDURL;

  protected async request<T>(endpoint: string, options: CustomFetchOptions = {}): Promise<T> {
    const { requiresAuth = true, headers: customHeaders, ...restOptions } = options;

    const headers = new Headers(customHeaders);
    
    // Automatically set JSON content type if it's not raw binary data
    if (!headers.has('Content-Type') && !(restOptions.body instanceof Uint8Array)) {
      headers.set('Content-Type', 'application/json');
    }

    const fetchConfig: RequestInit = {
      ...restOptions,
      headers,
      credentials: requiresAuth ? 'include' : 'omit',
    };

    try {
      const response = await fetch(`${this.baseUrl}${endpoint}`, fetchConfig);
      
      if (response.status === 204) return null as T;

      const data: ApiSuccessResponse<T> | ApiErrorResponse = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || data.error || 'An unknown API error occurred');
      }

      return data.data as T;

    } catch (error) {
      console.error(`[API Error] ${options.method || 'GET'} ${endpoint}:`, error);
      throw error;
    }
  }
}