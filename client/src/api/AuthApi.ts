import { BaseApi } from './BaseApi';
import type { 
  LoginStatusResponse, 
  LogoutResponse,
  OpaqueRegisterInitRequest,
  OpaqueRegisterInitResponse,
  OpaqueRegisterFinishRequest,
  OpaqueRegisterFinishResponse,
  OpaqueLoginStartRequest,
  OpaqueLoginStartResponse,
  OpaqueLoginVerifyRequest
} from './types'; 

export class AuthApi extends BaseApi {
  
  async registerOpaqueInit(data: OpaqueRegisterInitRequest) {
    return this.request<OpaqueRegisterInitResponse>('/auth/register/opq/init', {
      method: 'POST',
      requiresAuth: false,
      body: JSON.stringify(data),
    });
  }

  async registerOpaqueFinish(data: OpaqueRegisterFinishRequest) {
    return this.request<OpaqueRegisterFinishResponse>('/auth/register/opq/finish', {
      method: 'POST',
      requiresAuth: false,
      body: JSON.stringify(data),
    });
  }

  async loginOpaqueStart(data: OpaqueLoginStartRequest) {
    return this.request<OpaqueLoginStartResponse>('/auth/login/start', {
      method: 'POST',
      requiresAuth: false,
      body: JSON.stringify(data),
    });
  }

  async loginOpaqueVerify(data: OpaqueLoginVerifyRequest) {
    return this.request<null>('/auth/login/verify', {
      method: 'POST',
      requiresAuth: true,
      body: JSON.stringify(data),
    });
  }

  async checkStatus() {
    return this.request<LoginStatusResponse>('/auth/status', {
      method: 'GET',
      requiresAuth: true, 
    });
  }

  async logout() {
    return this.request<LogoutResponse>('/auth/logout', {
      method: 'POST',
      requiresAuth: true, 
    });
  }
}