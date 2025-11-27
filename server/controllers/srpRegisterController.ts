import { Response } from 'express';
import { srpCreateUserService } from '../services/srpCreateUserService.js';
import { createUserFileSpace } from '../services/createUserFileSpaceService.js';
import { SrpRegisterRequest, ApiSuccessResponse, ApiErrorResponse } from '../types/index.js';

interface SrpRegisterSuccessData {
  user: {
    username: string;
    email: string;
  };
  folder: string;
}

export async function srpRegisterController(
  req: SrpRegisterRequest,
  res: Response<ApiSuccessResponse<SrpRegisterSuccessData> | ApiErrorResponse>
): Promise<void> {
  try {
    const { username, email, salt, verifier} = req.body;

    if (!username || !email || !salt || !verifier) {
      res.status(400).json({ message: 'All fields are required', success: false });
      return;
    }

    const user = await srpCreateUserService({ username, email, salt, verifier });
    const folder = await createUserFileSpace({ username });

    res.status(201).json({
      message: 'User registered successfully',
      data: { user, folder },
      success: true
    });
  } catch (error) {
    const err = error as Error;
    res.status(500).json({ message: err.message, success: false });
  }
}

export default srpRegisterController;
