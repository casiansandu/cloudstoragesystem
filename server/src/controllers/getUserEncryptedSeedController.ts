
import {Response } from 'express';
import { ApiErrorResponse, ApiSuccessResponse, AuthenticatedRequest, GetEncryptedSeedResult } from "../types";
import { getIdByUsername } from '../services/getIdByUsername';
import getEncryptedSeedService from '../services/getUserEncryptedSeed';

export async function getUserEncryptedSeedController(req: AuthenticatedRequest, res: Response<ApiSuccessResponse<GetEncryptedSeedResult> | ApiErrorResponse>): Promise<void> {
    
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
        const seed = await getEncryptedSeedService(id);    
        
        res.status(200).json({ 
            message: 'Encrypted seed retrieved successfully',
            data: {
                encrypted_seed: seed.encrypted_seed,
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