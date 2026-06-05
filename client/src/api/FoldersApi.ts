import { BaseApi } from './BaseApi';
import type { 
  FolderInfo,
  GetSubfoldersResponse,
  GetFolderDataResponse,
  CheckRootFolderExistsResponse,
  GetRootFolderIdResponse,
  GetFolderAccessTypeResponse,
  GetFolderPermissionsResponse,
  CheckFolderAccessResponse,
  GetFolderEncryptedKeyResponse,
  GetFolderHybridInfoResponse,
  CreateFolderRequest,
  CreateFolderResponse,
  DeleteFolderResponse,
  GetSharedFoldersResponse,
  GetSharedFolderParentResponse,
  GetSharedSubfoldersResponse,
  ShareFolderHybridRequest,
  ShareFolderHybridResponse,
  GetFolderFilesResponse, // From file types
  GetSharedFilesResponse  // From file types
} from './types'; 

export class FoldersApi extends BaseApi {

  // ==========================================
  // CORE INFORMATION & LISTING
  // ==========================================

  async getRootId() {
    return this.request<GetRootFolderIdResponse>('/folders/root/id', {
      method: 'GET'
    });
  }

  async checkRootExists() {
    return this.request<CheckRootFolderExistsResponse>('/folders/root/exists', {
      method: 'GET'
    });
  }

  async getData(folderId: string) {
    return this.request<GetFolderDataResponse>(`/folders/${folderId}/data`, {
      method: 'GET'
    });
  }

  async getSubfolders(folderId: string) {
    return this.request<GetSubfoldersResponse>(`/folders/${folderId}/folders`, {
      method: 'GET'
    });
  }

  // Note: This hits the folders router, even though it returns file data
  async getFiles(folderId: string) {
    return this.request<GetFolderFilesResponse>(`/folders/${folderId}/files`, {
      method: 'GET'
    });
  }

  // ==========================================
  // ACCESS & KEYS
  // ==========================================

  async checkAccess(folderId: string) {
    return this.request<CheckFolderAccessResponse>(`/folders/hasaccess/${folderId}`, {
      method: 'GET'
    });
  }

  async getAccessType(folderId: string) {
    return this.request<GetFolderAccessTypeResponse>(`/folders/${folderId}/access_type`, {
      method: 'GET'
    });
  }

  async getPermissions(folderId: string) {
    return this.request<GetFolderPermissionsResponse>(`/folders/${folderId}/permissions`, {
      method: 'GET'
    });
  }

  async getEncryptedKey(folderId: string) {
    return this.request<GetFolderEncryptedKeyResponse>(`/folders/${folderId}/encrypted_key`, {
      method: 'GET'
    });
  }

  async getHybridInfo(folderId: string) {
    return this.request<GetFolderHybridInfoResponse>(`/folders/${folderId}/hybrid_info`, {
      method: 'GET'
    });
  }

  // ==========================================
  // SHARING
  // ==========================================

  async getShared() {
    return this.request<GetSharedFoldersResponse>('/folders/shared', {
      method: 'GET'
    });
  }

  async getSharedSubfolders(folderId: string) {
    return this.request<GetSharedSubfoldersResponse>(`/folders/${folderId}/shared/folders`, {
      method: 'GET'
    });
  }

  async getSharedFiles(folderId: string) {
    return this.request<GetSharedFilesResponse>(`/folders/${folderId}/shared/files`, {
      method: 'GET'
    });
  }

  async getSharedParent(folderId: string) {
    return this.request<GetSharedFolderParentResponse>(`/folders/${folderId}/shared/parent`, {
      method: 'GET'
    });
  }

  async shareHybrid(data: ShareFolderHybridRequest) {
    return this.request<ShareFolderHybridResponse>('/folders/share', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }

  // ==========================================
  // MANAGEMENT
  // ==========================================

  async create(data: CreateFolderRequest) {
    return this.request<CreateFolderResponse>('/folders/create', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }

  async delete(folderId: string) {
    return this.request<DeleteFolderResponse>(`/folders/${folderId}`, {
      method: 'DELETE'
    });
  }
}