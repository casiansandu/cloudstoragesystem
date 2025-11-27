import { Request } from 'express';

// Database Models
export interface User {
  id: number;
  username: string;
  email: string;
  password_hash: string;
  created_at?: Date;
}

export interface Session {
  username: string;
  token: string;
  created_at?: Date;
}

// API Request/Response Types using Utility Types
export type UserRegistration = Omit<User, 'id' | 'password_hash' | 'created_at'> & {
  password: string;
};

export type UserLogin = Pick<User, 'username'> & {
  password: string;
};

export type UserPublic = Omit<User, 'password_hash'>;

export type UserCreationResult = Pick<User, 'username' | 'email'>;

export interface LoginResult {
  username: string;
  token: string;
}

export interface LogoutResult {
  username: string;
}

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
  data: T;
}

export interface ApiErrorResponse extends ApiResponse {
  message: string;
  success: false;
  error?: string;
}

// JWT Payload
export interface JwtPayload {
  id: number;
  username: string;
  iat?: number;
  exp?: number;
}

// Express Request Extensions
export interface AuthenticatedRequest extends Request {
  user?: string;
}

export interface CreateDirRequest extends AuthenticatedRequest {
  body: {
    folderPath: string;
  };
}

export interface RegisterRequest extends Request {
  body: UserRegistration;
}

export interface LoginRequest extends Request {
  body: UserLogin;
}

// Environment Config
export interface Config {
  PORT: string;
  JWT_SECRET: string;
  DB_NAME: string;
  DB_USERNAME: string;
  DB_PASSWORD: string;
  FILESYSTEM_ROOT: string;
}

// Database Query Results
export type DatabaseUser = User | null;
export type DatabaseUsers = User[];
export type DatabaseSession = Session | null;
