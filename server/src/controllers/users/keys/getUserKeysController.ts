
import { Response } from 'express';
import getUserKeysService from "../../../services/users/keys/getUserKeysService";
import { ApiErrorResponse, ApiSuccessResponse, AuthenticatedRequest } from "../../../types";
import { GetKeysResult } from '../../../types';

export async function getUserKeysController(req: AuthenticatedRequest, res: Response<ApiSuccessResponse<GetKeysResult> | ApiErrorResponse>): Promise<void> {
                

    try {
        const { id } =  req.user!;
        const keys = await getUserKeysService(id);    
        
        res.status(200).json({ 
            message: 'Keys retrieved successfully',
            data: {
                kdf_salt: keys.kdf_salt,
            }, 
            success: true });
        return;
    } catch (error) {
        console.error('Get user keys failed:', error);
        res.status(500).json({
            message: 'Unable to retrieve keys',
            success: false
        });
        return;
    }
}

