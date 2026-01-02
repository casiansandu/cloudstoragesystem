
import {Request, Response } from 'express';
import getUserKeysService from "../services/getUserKeysService";
import { ApiErrorResponse, ApiSuccessResponse, AuthenticatedRequest } from "../types";
import { GetKeysResult } from '../types';

export async function getUserKeysController(req: AuthenticatedRequest, res: Response<ApiSuccessResponse<GetKeysResult> | ApiErrorResponse>): Promise<void> {
                

    try {
        const { id, username } =  req.user!;
        const keys = await getUserKeysService(id);    
        
        res.status(200).json({ 
            message: 'Keys retrieved successfully',
            data: {
                encryption_salt: keys.encryption_salt,
                encrypted_private_key: keys.encrypted_private_key,
                encryption_public_key: keys.encryption_public_key,
                encrypted_directory_key: keys.encrypted_directory_key
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