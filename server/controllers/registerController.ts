import { Response } from 'express';
import { createUserService } from '../services/createUserService';
import { RegisterRequest, ApiSuccessResponse, ApiErrorResponse } from '../types';

interface RegisterSuccessData {
  user: {
    username: string;
    email: string;
  };
}

export async function registerController(
  req: RegisterRequest,
  res: Response<ApiSuccessResponse<RegisterSuccessData> | ApiErrorResponse>
): Promise<void> {
  try {
    const { username, email, password } = req.body;

    if (!username || !email || !password) {
      res.status(400).json({ message: 'All fields are required', success: false });
      return;
    }

    const user = await createUserService({ username, email, password });

    res.status(201).json({
      message: 'User registered successfully',
      data: { user },
      success: true
    });
  } catch (error) {
    const err = error as Error;
    res.status(500).json({ message: err.message, success: false });
  }
}

export default registerController;
