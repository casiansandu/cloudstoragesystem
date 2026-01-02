import { Request } from 'express';
import { BufferSource } from 'stream/web';

// Database Models
export interface User {
  id: string;
  username: string;
  email: string;
  password_hash: string;
  created_at?: Date;
}

export interface SrpUser {
  id: string;
  username: string;
  email: string;
  created_at?: Date;

  srp_salt: string;
  srp_verifier: string;

  encryption_salt: string;
  encryption_public_key: string;
  encrypted_private_key: string;
  encrypted_directory_key: string;
}

export interface UserAccess {
  encrypted_file_key: string;
  file_id: string;
  access_id: string;
  user_id: string;
  encrypted_manifest_key: string;
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

export type SrpUserRegistration = Omit<SrpUser, 'id' | 'created_at'>;

export interface FinishFileUploadRequest extends AuthenticatedRequest {
  encyrpted_manifest: Uint8Array;
}

export interface LoginStatusResponse {
  isAuthenticated: boolean;
}

export interface FileUploadRequest extends AuthenticatedRequest {
  body: Uint8Array;
};

export interface StartFileUploadRequest extends AuthenticatedRequest {
  body: {
    name: string;
    path: string;
    file_size: number;
    encrypted_file_key: string;
    encrypted_manifest_key: string;
  };
};

export type UserLogin = Pick<User, 'username'> & {
  password: string;
};

export type SrpLoginStart = Pick<SrpUser, 'username' > & {
  client_public: string;
};

export type SrpLoginVerify = {
  loginSessionId: string;
  client_session_proof: string;
};

export interface SrpLoginStartRequest extends Request {
  body: SrpLoginStart;
}

export interface SrpLoginVerifyRequest extends Request {
  body: SrpLoginVerify;
}

export interface ShareFileRequest extends AuthenticatedRequest {
  body: {
    file_id: string;
    recipient_username: string;
    encrypted_file_key: string;
    encrypted_manifest_key: string;
  };
}

export type UserPublic = Omit<User, 'password_hash'>;

export type UserCreationResult = Pick<User, 'username' | 'email'>;

export type GetKeysResult = Pick<SrpUser, 'encryption_salt' | 'encryption_public_key' | 'encrypted_private_key' | 'encrypted_directory_key'>;
export type GetPublicKeyResult = Pick<SrpUser, 'encryption_public_key'>;
export type GetManifestKeyResult = Pick<UserAccess, 'encrypted_manifest_key'>;

export type SrpCredentials = Omit<SrpUser, 'id' | 'created_at'>;

export interface GetFileMasterKeyResult {
  encrypted_master_key: string;
}

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
  data?: T;
}

export interface ApiErrorResponse extends ApiResponse {
  message: string;
  success: false;
  error?: string;
}

// JWT Payload
export interface JwtPayload {
  id: string;
  username: string;
  iat?: number;
  exp?: number;
}

//Get all file names
export interface GetAllFilesData {
    files: Array<{
        name: string;
    }>;
}

export interface OwnershipTestResult {
    isOwner: boolean;
}

// Express Request Extensions
export interface AuthenticatedRequest extends Request {
  user?: { id: string; username: string };
}

export interface CreateDirRequest extends AuthenticatedRequest {
  body: {
    folderPath: string;
  };
}

export interface RegisterRequest extends Request {
  body: UserRegistration;
}

export interface SrpRegisterRequest extends Request {
  body: SrpUserRegistration;
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
  REDIS_URL: string;
  FOLDER_NAMING_SECRET: string;
}

// Database Query Results
export type DatabaseUser = User | null;
export type DatabaseUsers = User[];
export type DatabaseSession = Session | null;
