
import { Response } from 'express';
import { ApiErrorResponse, ApiSuccessResponse, AuthenticatedRequest, GetEncryptedSeedResult } from "../../types";
import getEncryptedSeedService from '../../services/users/getUserEncryptedSeed';

export async function getUserEncryptedSeedController(req: AuthenticatedRequest, res: Response<ApiSuccessResponse<GetEncryptedSeedResult> | ApiErrorResponse>): Promise<void> {
    
    const user = req.user;

    if (!user) {
        res.status(401).json({
            message: 'Unauthorized',
            success: false
        });
        return;
    }

    try {
        const seed = await getEncryptedSeedService(user.id);    
        
        res.status(200).json({ 
            message: 'Encrypted seed retrieved successfully',
            data: {
                encrypted_seed: seed.encrypted_seed,
            }, 
            success: true });
        return;
    } catch (error) {
        console.error('Get encrypted seed failed:', error);
        res.status(500).json({
            message: 'Unable to retrieve encrypted seed',
            success: false
        });
        return;
    }
}