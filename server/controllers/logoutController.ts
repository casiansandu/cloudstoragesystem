import { Response } from 'express';
import { logoutService } from '../services/logoutService';
import { AuthenticatedRequest, ApiSuccessResponse, ApiErrorResponse } from '../types';

interface LogoutSuccessData {
  user: {
    username: string;
  };
}

export async function logoutController(
  req: AuthenticatedRequest,
  res: Response<ApiSuccessResponse<LogoutSuccessData> | ApiErrorResponse>
): Promise<void> {
  try {
    const username = req.user;

    if (!username) {
      res.status(400).json({ message: 'Username required', success: false });
      return;
    }

    const user = await logoutService(username);

    res.status(200).json({
      message: 'Logged out successfully',
      data: { user },
      success: true
    });
  } catch (error) {
    const err = error as Error;
    res.status(500).json({ message: err.message, success: false });
  }
}

export default logoutController;
