// Types for API responses from backend controllers

// 1. Auth check (checkLoggedIn)
export interface AuthCheckResponse {
  success: boolean;
  isAuthenticated: boolean;
  message: string;
}

// 2. File upload (generic file upload response)
export type FileUploadResponse = {
  message: string;
  data?: {
    file_id?: string;
    access_id?: string;
    stored_bytes?: number;
  };
  success: boolean;
}


export type ManifestData = {
  file_id: string;
  totalChunks: number;
  uploadedAt: string;
  encryptedFileKey: string; 
  file_size: number;
  chunkInfos: {
    index: number;
    id: string;
    ciphertextLength: number;
  }[];
};

export interface ErrorResponse {
  error: string;
}

export interface UserFile {
  id: string;
  name: string;
}
export interface GetAllUserFilesResponse {
  message: string;
  data: {
    files: UserFile[];
  };
  success: boolean;
}

// 4. Get all users (getAllUsersController)
export interface User {
  id: number;
  username: string;
  email: string;
  created_at?: string;
}
export interface GetAllUsersResponse {
  users: User[];
}

// 5. Get user keys (getUserKeysController)
export interface GetUserKeysResponse {
  message: string;
  data: {
    encryption_salt: string;
    encrypted_private_key: string;
    encryption_public_key: string;
    encryption_nonce: string;
  };
  success: boolean;
}

// 6. SRP Login Start (srpLoginStart)
export interface SrpLoginStartResponse {
  message: string;
  data: {
    salt: string;
    server_public: string;
    loginSessionId: string;
  };
  success: boolean;
}

// 7. SRP Login Verify (srpLoginVerify)
export interface SrpLoginVerifyResponse {
  message: string;
  data: {
    server_session_proof: string;
    token: string;
  };
  success: boolean;
}

// 8. SRP Register (registerController)
export interface SrpRegisterResponse {
  message: string;
  data: {
    user: {
      username: string;
      email: string;
    };
  };
  success: boolean;
}

// Generic error response (used in multiple places)
export interface ApiErrorResponse {
  message: string;
  success: false;
  error?: string;
}
