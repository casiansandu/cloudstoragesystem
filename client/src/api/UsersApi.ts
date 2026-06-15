import { BaseApi } from './BaseApi';
import type { 
  GetAllUserFileKeysResponse,
  GetEncryptedArkResponse,
  GetEncryptedSeedResponse,
  GetUserKeysResponse,
  GetPublicKeyBundleResponse,
  GetPublicKeyResponse
} from './types'; 

export class UsersApi extends BaseApi {

  async getUserId(username: string) {
    return this.request<{ user_id: string }>(`/users/${username}/id`, {
      method: 'GET'
    });
  }

  // ==========================================
  // GENERAL USER KEYS (Authenticated User)
  // ==========================================

  async getKeys() {
    return this.request<GetUserKeysResponse>('/users/keys', {
      method: 'GET'
    });
  }

  async getEncryptedArk() {
    return this.request<GetEncryptedArkResponse>('/users/keys/encrypted_ark', {
      method: 'GET'
    });
  }

  async getEncryptedSeed() {
    return this.request<GetEncryptedSeedResponse>('/users/keys/encrypted_seed', {
      method: 'GET'
    });
  }

  async getAllFileKeys() {
    return this.request<GetAllUserFileKeysResponse>('/users/file-keys', {
      method: 'GET'
    });
  }

  // ==========================================
  // PUBLIC KEYS (For sharing with other users)
  // ==========================================

  async getPublicKeyBundle(username: string) {
    return this.request<GetPublicKeyBundleResponse>(`/users/keys/${username}/public_keys_bundle`, {
      method: 'GET'
    });
  }

  async getPublicKey(username: string) {
    return this.request<GetPublicKeyResponse>(`/users/keys/${username}/public_key`, {
      method: 'GET'
    });
  }
}