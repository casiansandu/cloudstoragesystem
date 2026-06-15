// ==========================================
// BASE API TYPES
// ==========================================

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

// ==========================================
// AUTHENTICATION TYPES
// ==========================================

export interface LoginStatusResponse {
  isAuthenticated: boolean;
}

export interface LogoutResponse {
  message: string;
}

export interface OpaqueRegisterInitRequest {
  username: string;
  registrationRequest: string;
}

export interface OpaqueRegisterInitResponse {
  registrationResponse: string;
}

export interface OpaqueRegisterFinishRequest {
  username: string;
  email: string;
  registrationRecord: string;
  kdf_salt: string;
  public_keys_bundle: string;
  encrypted_seed: string;
  encrypted_ark: string;
}

export interface OpaqueRegisterFinishResponse {
  user: {
    id: string;
    username: string;
  };
}

export interface OpaqueLoginStartRequest {
  username: string;
  startLoginRequest: string;
}

export interface OpaqueLoginStartResponse {
  loginResponse: string;
  loginSessionId: string;
}

export interface OpaqueLoginVerifyRequest {
  finishLoginRequest: string;
  loginSessionId: string;
}

// ==========================================
// FILE DOMAIN TYPES
// ==========================================

export interface FileInfo {
  id: string;
  encrypted_name_data: string;
}

export interface FolderFileInfo extends FileInfo {
  encrypted_key_data: string;
}

export interface GetAllFilesResponse {
  files: FileInfo[];
}

export interface CheckOwnershipResponse {
  isOwner: boolean;
}

export interface CheckFileAccessResponse {
  access_id: string;
}

export interface GetFolderFilesResponse {
  files: FolderFileInfo[];
}

export interface GetFileMasterKeyResponse {
  encrypted_file_key: string;
}

export interface GetHybridInfoResponse {
  x25519_ephemeral_public: string;
  mlkem_ciphertext: string;
}

export type DownloadChunkResponse = Blob; 

export interface StartHybridUploadRequest {
  name: string;
  file_size: number;
  encrypted_file_key: string;
  share_duration: number;
  folder_id: string;
}

export interface StartHybridUploadResponse {
  file_id: string;
  access_id: string;
}

export interface UploadChunkResponse {
  stored_bytes: number;
}

export interface GetOwnerIdResponse {
  owner_id: string;
}

export type DeleteFileResponse = null;

// ==========================================
// FILE SHARING TYPES
// ==========================================

export interface SharedFileInfo {
  id: string;
  encrypted_name_data: string;
  encrypted_file_key: string; 
  owner_id?: string; 
}

export interface GetSharedFilesResponse {
  files: SharedFileInfo[];
}

export interface ShareFileHybridRequest {
  file_id: string;
  recipient_username: string;
  encrypted_file_key: string;
  share_duration: number;
  mlkem_ciphertext: string;
  x25519_ephemeral_public: string;
  signature: string;
}

export interface ShareFileHybridResponse {
  file_access_id: string;
}

// ==========================================
// FOLDER DOMAIN TYPES
// ==========================================

export type FolderAccessType = "owner" | "shared" | "shared_subfolder";

export interface FolderPermissions {
  can_download: boolean;
  can_upload: boolean;
  can_share: boolean;
  can_delete: boolean;
}

// A generic interface for subfolders, shared folders, etc.
export interface FolderInfo {
  id: string;
  encrypted_name_data: string;
  encrypted_key_data: string;
}

// --- Information & Listings ---
export interface GetSubfoldersResponse {
  folders: FolderInfo[];
}

export interface GetFolderDataResponse {
  folder_id: string;
  parent_id: string | null;
  encrypted_key_data: string;
  encrypted_key_data_parent: string;
  encrypted_name_data: string;
  signature: string;
}

export interface CheckRootFolderExistsResponse {
  exists: boolean;
  id: string; 
}

export interface GetRootFolderIdResponse {
  root_folder_id: string;
}

// --- Access & Keys ---
export interface GetFolderAccessTypeResponse {
  access_type: FolderAccessType;
}

export interface GetFolderPermissionsResponse {
  permissions: FolderPermissions;
}

export interface CheckFolderAccessResponse {
  access_id: string;
}

export interface GetFolderEncryptedKeyResponse {
  encrypted_key_data: string;
}

export interface GetFolderHybridInfoResponse {
  x25519_ephemeral_public: string;
  mlkem_ciphertext: string;
}

// --- Management ---
export interface CreateFolderRequest {
  encrypted_key_data_ark: string;
  encrypted_key_data_parent: string;
  parent_folder_id?: string;
  encrypted_folder_name_data?: string;
  signature: string;
}

export interface CreateFolderResponse {
  folder_id: string;
  access_id: string;
}

export type DeleteFolderResponse = null;

// ==========================================
// FOLDER SHARING TYPES
// ==========================================

export interface GetSharedFoldersResponse {
  folders: FolderInfo[];
}

export interface GetSharedFolderParentResponse {
  parent_id: string | null;
  encrypted_parent_name_data: string | null;
}

// Reusing FolderInfo since it has the exact same structure
export interface GetSharedSubfoldersResponse {
  folders: FolderInfo[];
}

export interface ShareFolderHybridRequest {
  folder_id: string;
  recipient_username: string;
  encrypted_folder_key: string;
  share_duration: number;
  mlkem_ciphertext: string;
  x25519_ephemeral_public: string;
  permissions: FolderPermissions;
  signature: string;
}

export interface ShareFolderHybridResponse {
  folder_access_id: string;
}

// Note: getSharedFilesInFolder uses GetSharedFilesResponse from the Files section
// because it returns an array of files, not folders.

// ==========================================
// USERS & KEYS DOMAIN TYPES
// ==========================================

export interface FileKeyData {
  file_id: string;
  encrypted_file_key: string;
}

export interface GetAllUserFileKeysResponse {
  fileKeysData: FileKeyData[];
}

export interface GetEncryptedArkResponse {
  encrypted_ark: string;
}

export interface GetEncryptedSeedResponse {
  encrypted_seed: string;
}

export interface GetUserKeysResponse {
  kdf_salt: string;
  encrypted_user_rsa_private: string;
  user_rsa_public: string;
}

export interface GetPublicKeyBundleResponse {
  public_keys_bundle: string;
}

export interface GetPublicKeyResponse {
  user_rsa_public: string;
}