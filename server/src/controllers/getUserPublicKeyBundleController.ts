
import {Response } from 'express';
import { ApiErrorResponse, ApiSuccessResponse, AuthenticatedRequest, GetPublicKeyBundleResult } from "../types";
import { getIdByUsername } from '../services/getIdByUsername';
import getPublicKeyBundleService from '../services/getUserPublicKeyBundleService';

export async function getUserPublicKeyBundleController(req: AuthenticatedRequest, res: Response<ApiSuccessResponse<GetPublicKeyBundleResult> | ApiErrorResponse>): Promise<void> {
    
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
        const keys = await getPublicKeyBundleService(id);    
        
        res.status(200).json({ 
            message: 'Public key bundle retrieved successfully',
            data: {
                public_keys_bundle: keys.public_keys_bundle,
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