import { Response } from 'express';
import { loginService } from '../services/loginService.js';
import { LoginRequest, ApiSuccessResponse, ApiErrorResponse } from '../types/index.js';

interface LoginSuccessData {
  user: string;
}

export async function loginController(
  req: LoginRequest,
  res: Response<ApiSuccessResponse<LoginSuccessData> | ApiErrorResponse>
): Promise<void> {
  try {
        
   }
   catch (error: any) {
   
    }
}

export default loginController;
