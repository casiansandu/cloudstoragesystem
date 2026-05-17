
import { Response } from 'express';
import { ApiErrorResponse, ApiSuccessResponse, AuthenticatedRequest, GetEncryptedArkResult } from "../../types";
import { getIdByUsername } from '../../services/users/getIdByUsername';
import getEncryptedArkService from '../../services/users/getUserEncryptedArkService';

export async function getUserEncryptedArkController(req: AuthenticatedRequest, res: Response<ApiSuccessResponse<GetEncryptedArkResult> | ApiErrorResponse>): Promise<void> {
    
    const username = req.params.username;

    try {
        const id = await getIdByUsername(username);
        if (!id) {
            res.status(404).json({
                message: 'User not found',
                success: false
            });
            return;
        }
        const seed = await getEncryptedArkService(id);    
        
        res.status(200).json({ 
            message: 'Encrypted ark retrieved successfully',
            data: {
                encrypted_ark: seed.encrypted_ark,
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