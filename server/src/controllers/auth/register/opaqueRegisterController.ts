import { Request, Response } from 'express';
import { opaqueRegisterInitService, opaqueRegisterFinishService } from '../../../services/auth/register/opaqueRegisterService';
import { ApiErrorResponse, ApiSuccessResponse } from '../../../types';

export async function opaqueRegisterInit(
  req: Request,
  res: Response<ApiSuccessResponse<{ registrationResponse: string }> | ApiErrorResponse>
): Promise<void> {
  try {
    const { username, registrationRequest } = req.body;

    if (!username || !registrationRequest) {
      res.status(400).json({ message: 'Username and registrationRequest are required', success: false });
      return;
    }

    const { registrationResponse } = await opaqueRegisterInitService(username, registrationRequest);

    res.status(200).json({
      message: 'OPAQUE Registration Init successful',
      data: { registrationResponse },
      success: true
    });
  } catch (error) {
    console.error('OPAQUE registration init failed:', error);
    res.status(500).json({ message: 'Unable to initialize registration', success: false });
  }
}

export async function opaqueRegisterFinish(
  req: Request,
  res: Response<ApiSuccessResponse<{ user: { id: string; username: string } }> | ApiErrorResponse>
): Promise<void> {
  try {
    const { 
      username, email, registrationRecord, kdf_salt,
      public_keys_bundle, encrypted_seed, encrypted_ark,
    } = req.body;

    if (!username || !email || !registrationRecord || !kdf_salt || 
        !public_keys_bundle || !encrypted_seed || !encrypted_ark) {
      res.status(400).json({ message: 'All fields are required', success: false });
      return;
    }

    const user = await opaqueRegisterFinishService(req.body);

    res.status(201).json({
      message: 'OPAQUE User registered successfully',
      data: { user },
      success: true
    });
  } catch (error) {
    console.error('OPAQUE registration finish failed:', error);
    res.status(500).json({ message: 'Unable to finalize registration', success: false });
  }
}

