
import {Response } from 'express';
import { ApiErrorResponse, ApiSuccessResponse, AuthenticatedRequest, GetPublicKeyBundleResult } from "../../../types";
import getPublicKeyBundleService from '../../../services/users/keys/getUserPublicKeyBundleService';
import { isUuidV4 } from '../../../utils/validators';

export async function getUserPublicKeyBundleController(req: AuthenticatedRequest, res: Response<ApiSuccessResponse<GetPublicKeyBundleResult> | ApiErrorResponse>): Promise<void> {
    
    const user_id = req.params.user_id;

    if (!user_id) {
        res.status(400).json({
            message: 'User ID is required',
            success: false
        });
        return;
    }

    if (!isUuidV4(user_id)) {
        res.status(400).json({
            message: 'Invalid user ID format',
            success: false
        });
        return;
    }

    try {
        const keys = await getPublicKeyBundleService(user_id);    
        
        res.status(200).json({ 
            message: 'Public key bundle retrieved successfully',
            data: {
                public_keys_bundle: keys.public_keys_bundle,
            }, 
            success: true });
        return;
    } catch (error) {
        console.error('Get user public key bundle failed:', error);
        res.status(500).json({
            message: 'Unable to retrieve public key bundle',
            success: false
        });
        return;
    }
}

