
import { Response } from 'express';
import getUserKeysService from "../../services/users/getUserKeysService";
import { ApiErrorResponse, ApiSuccessResponse, AuthenticatedRequest } from "../../types";
import { GetKeysResult } from '../../types';

export async function getUserKeysController(req: AuthenticatedRequest, res: Response<ApiSuccessResponse<GetKeysResult> | ApiErrorResponse>): Promise<void> {
                

    try {
        const { id } =  req.user!;
        const keys = await getUserKeysService(id);    
        
        res.status(200).json({ 
            message: 'Keys retrieved successfully',
            data: {
                kdf_salt: keys.kdf_salt,
                encrypted_user_rsa_private: keys.encrypted_user_rsa_private,
                user_rsa_public: keys.user_rsa_public,
            }, 
            success: true });
        return;
    } catch (error) {
        res.status(500).json({
            message: (error as Error).message,
            success: false
        });
        return;
    }
}