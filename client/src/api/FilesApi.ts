import { BaseApi } from './BaseApi';
import type { 
  GetAllFilesResponse,
  GetSharedFilesResponse,
  CheckOwnershipResponse,
  CheckFileAccessResponse,
  GetFileMasterKeyResponse,
  GetHybridInfoResponse,
  StartHybridUploadRequest,
  StartHybridUploadResponse,
  UploadChunkResponse,
  ShareFileHybridRequest,
  ShareFileHybridResponse,
  DeleteFileResponse
} from './types'; 

export class FilesApi extends BaseApi {

  // ==========================================
  // INFORMATION & LISTING
  // ==========================================

  async getAll() {
    return this.request<GetAllFilesResponse>('/files/all', {
      method: 'GET'
    });
  }

  async getShared() {
    return this.request<GetSharedFilesResponse>('/files/shared', { 
      method: 'GET' 
    });
  }

  async getHybridInfo(fileId: string) {
    return this.request<GetHybridInfoResponse>(`/files/${fileId}/hybrid_info`, {
      method: 'GET'
    });
  }

  // ==========================================
  // ACCESS & KEYS
  // ==========================================

  async checkOwnership(fileId: string) {
    return this.request<CheckOwnershipResponse>(`/files/isowner/${fileId}`, {
      method: 'GET'
    });
  }

  async checkAccess(fileId: string) {
    return this.request<CheckFileAccessResponse>(`/files/hasaccess/${fileId}`, {
      method: 'GET'
    });
  }

  async getMasterKey(fileId: string) {
    return this.request<GetFileMasterKeyResponse>(`/files/${fileId}/key`, {
      method: 'GET'
    });
  }

  // ==========================================
  // UPLOAD & TRANSFER
  // ==========================================

  async startHybridUpload(data: StartHybridUploadRequest) {
    return this.request<StartHybridUploadResponse>('/files/upload/start_hybrid', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }

  async uploadChunk(fileId: string, chunkId: string, chunkData: Uint8Array) {
    return this.request<UploadChunkResponse>(`/files/upload/${fileId}/${chunkId}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/octet-stream' 
      },
      // Safely pass the underlying ArrayBuffer
      body: chunkData.buffer as ArrayBuffer
    });
  }

  async downloadChunk(fileId: string, chunkId: string): Promise<Blob> {
    const response = await fetch(`${this.baseUrl}/files/download/${fileId}/${chunkId}`, {
      method: 'GET',
      credentials: 'include', 
    });

    if (!response.ok) {
      throw new Error(`Failed to download chunk: ${response.statusText}`);
    }

    return response.blob();
  }

  // ==========================================
  // SHARING & MANAGEMENT
  // ==========================================

  async shareHybrid(data: ShareFileHybridRequest) {
    return this.request<ShareFileHybridResponse>('/files/share_hybrid', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }

  async delete(fileId: string) {
    return this.request<DeleteFileResponse>(`/files/${fileId}`, {
      method: 'DELETE'
    });
  }
}