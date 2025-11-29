import { Response } from 'express';
import { createSrpUserService } from '../services/createSrpUserService';
import { SrpRegisterRequest, ApiSuccessResponse, ApiErrorResponse } from '../types';


interface RegisterSuccessData {
  user: {
    username: string;
    email: string;
  };
}

export async function registerController(
  req: SrpRegisterRequest,
  res: Response<ApiSuccessResponse<RegisterSuccessData> | ApiErrorResponse>
): Promise<void> {
  try {
    console.log("Received: ", req.body);
    const { username, email, salt, verifier } = req.body;

    if (!username || !email || !salt || !verifier) {
      res.status(400).json({ message: 'All fields are required', success: false });
      return;
    }

    const user = await createSrpUserService({ username, email, salt, verifier });

    res.status(201).json({
      message: 'Srp User registered successfully',
      data: { user },
      success: true
    });
  } catch (error) {
    const err = error as Error;
    res.status(500).json({ message: err.message, success: false });
  }
}

export default registerController;
