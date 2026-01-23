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
    //console.log("Received: ", req.body);
    const { 
      username, email, 
      srp_salt, srp_verifier, 
      encryption_salt, encryption_public_key,  encrypted_private_key,
      public_keys_bundle, encrypted_seed } =  req.body;

    if (!username || !email || 
      !srp_salt || !srp_verifier || 
      !encryption_salt || !encryption_public_key || !encrypted_private_key || !public_keys_bundle || !encrypted_seed) {
      res.status(400).json({ message: 'All fields are required', success: false });
      return;
    }

    const user = await createSrpUserService({ 
      username, 
      email, 

      srp_salt, 
      srp_verifier, 

      encryption_salt, 
      encrypted_private_key, 
      encryption_public_key,
      public_keys_bundle,
      encrypted_seed
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
