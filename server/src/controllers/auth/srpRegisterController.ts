import { Response } from 'express';
import { createSrpUserService } from '../../services/auth/createSrpUserService';
import { SrpRegisterRequest, ApiSuccessResponse, ApiErrorResponse } from '../../types';


interface RegisterSuccessData {
  user: {
    username: string;
    id: string;
  };
}

export async function registerController(
  req: SrpRegisterRequest,
  res: Response<ApiSuccessResponse<RegisterSuccessData> | ApiErrorResponse>
): Promise<void> {
  try {
    const { 
      username, email, 
      srp_salt, srp_verifier, 
      kdf_salt, user_rsa_public,  encrypted_user_rsa_private,
      public_keys_bundle, encrypted_seed, encrypted_ark } =  req.body;

    if (!username || !email || 
      !srp_salt || !srp_verifier || 
      !kdf_salt || !user_rsa_public || !encrypted_user_rsa_private || !public_keys_bundle || !encrypted_seed || !encrypted_ark) {
      res.status(400).json({ message: 'All fields are required', success: false });
      return;
    }

    const user = await createSrpUserService({ 
      username, 
      email, 

      srp_salt, 
      srp_verifier, 

      kdf_salt, 
      encrypted_user_rsa_private, 
      user_rsa_public,
      public_keys_bundle,
      encrypted_seed,
      encrypted_ark
    });

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
