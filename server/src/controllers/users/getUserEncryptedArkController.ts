
import { Response } from 'express';
import { ApiErrorResponse, ApiSuccessResponse, AuthenticatedRequest, GetEncryptedArkResult } from "../../types";
import { getIdByUsername } from '../../services/users/getIdByUsername';
import getEncryptedArkService from '../../services/users/getUserEncryptedArkService';

export async function getUserEncryptedArkController(req: AuthenticatedRequest, res: Response<ApiSuccessResponse<GetEncryptedArkResult> | ApiErrorResponse>): Promise<void> {
    
    const user = req.user;

    if (!user) {
        res.status(401).json({
            message: 'Unauthorized',
            success: false
        });
        return;
    }

    try {
        const id = await getIdByUsername(user.username);
        if (!id) {
            res.status(404).json({
                message: 'User not found',
                success: false
            });
            return;
        }
        if (id !== user.id) {
            res.status(403).json({
                message: 'Forbidden',
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
        console.error('Get encrypted ark failed:', error);
        res.status(500).json({
            message: 'Unable to retrieve encrypted ark',
            success: false
        });
        return;
    }
}