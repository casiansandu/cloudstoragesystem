import { Request, Response } from 'express';
import { opaqueLoginStartService, opaqueLoginVerifyService } from '../../../services/auth/login/opaqueLoginService';
import { ApiErrorResponse, ApiSuccessResponse } from '../../../types';

interface OpaqueLoginStartSuccessData {
  loginResponse: string;
  loginSessionId: string;
}

export async function opaqueLoginStart(
  req: Request, 
  res: Response<ApiSuccessResponse<OpaqueLoginStartSuccessData> | ApiErrorResponse>
): Promise<void> {

  const { username, startLoginRequest } = req.body;

  if (!username || !startLoginRequest) {
    res.status(400).json({ message: 'Username and startLoginRequest are required', success: false });
    return;
  }

  try {
    const { loginResponse, loginSessionId } = await opaqueLoginStartService(username, startLoginRequest);
    
    res.status(200).json({
      message: 'OPAQUE Login Start successful',
      data: { loginResponse, loginSessionId },
      success: true
    });
  } catch (error) {
    console.error('OPAQUE login start failed:', error);
    res.status(500).json({ message: 'Login failed', success: false });
  }
}

export async function opaqueLoginVerify(
  req: Request, 
  res: Response<ApiSuccessResponse<null> | ApiErrorResponse>
): Promise<void> {

  const { loginSessionId, finishLoginRequest } = req.body;

  if (!loginSessionId || !finishLoginRequest) {
    res.status(400).json({ message: 'loginSessionId and finishLoginRequest are required', success: false });
    return;
  }

  try {
    const { token } = await opaqueLoginVerifyService(loginSessionId, finishLoginRequest);

    // Set the secure cookie exactly like you did in SRP
    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 3600000 // 1 hour
    });

    res.status(200).json({
      message: 'OPAQUE Login Verify successful',
      data: null, // The token is safely in the cookie
      success: true
    });
  } catch (error) {
    console.error('OPAQUE login verify failed:', error);
    res.status(401).json({ message: 'Invalid credentials', success: false });
  }
}

