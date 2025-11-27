import { Response } from 'express';
import { loginService } from '../services/loginService';
import { LoginRequest, ApiSuccessResponse, ApiErrorResponse } from '../types';

interface LoginSuccessData {
  user: string;
}

export async function loginController(
  req: LoginRequest,
  res: Response<ApiSuccessResponse<LoginSuccessData> | ApiErrorResponse>
): Promise<void> {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      res.status(400).json({ message: 'All fields are required', success: false });
      return;
    }

    const { username: user, token } = await loginService({ username, password });

    res.cookie('token', token, {
      httpOnly: true,
      secure: false,
      sameSite: 'lax',
      maxAge: 3600000
    });

    res.status(200).json({
      message: 'User login successfully',
      data: { user },
      success: true
    });
  } catch (error) {
    const err = error as Error;
    res.status(500).json({ message: err.message, success: false });
  }
}

export default loginController;
