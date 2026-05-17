
import {Response } from 'express';
import { ApiErrorResponse, ApiSuccessResponse, AuthenticatedRequest, GetPublicKeyResult } from "../../types";
import getPublicKeyService from '../../services/users/getUserPublicKeyService';
import { getIdByUsername } from '../../services/users/getIdByUsername';

export async function getUserPublicKeyController(req: AuthenticatedRequest, res: Response<ApiSuccessResponse<GetPublicKeyResult> | ApiErrorResponse>): Promise<void> {
    
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
        const keys = await getPublicKeyService(id);    
        
        res.status(200).json({ 
            message: 'Public key retrieved successfully',
            data: {
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