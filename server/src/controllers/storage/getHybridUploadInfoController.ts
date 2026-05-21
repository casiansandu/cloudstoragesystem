
import { Response } from 'express';
import { ApiErrorResponse, ApiSuccessResponse, AuthenticatedRequest, HybridInfoResult } from "../../types";
import { getHybridInfoService } from '../../services/storage/getHybridInfoService';
import { isUuidV4 } from "../../utils/validators";

export async function getHybridInfoController(req: AuthenticatedRequest, res: Response<ApiSuccessResponse<HybridInfoResult> | ApiErrorResponse>): Promise<void> {
    
    const user_id = req.user?.id;
    const file_id = req.params.file_id;

    if (!user_id) {
        res.status(401).json({ message: 'Unauthorized', success: false });
        return;
    }

    if (!file_id) {
        res.status(400).json({ message: 'Missing file ID', success: false });
        return;
    }

    if (!isUuidV4(file_id)) {
        res.status(400).json({ message: 'Invalid file ID', success: false });
        return;
    }

    try {
        const info = await getHybridInfoService(file_id, user_id);    
        res.status(200).json({ 
            message: 'Hybrid info retrieved successfully',
            data: {
                x25519_ephemeral_public: info.x25519_ephemeral_public,
                mlkem_ciphertext: info.mlkem_ciphertext,
            }, 
            success: true });
        return;
    } catch (error) {
        console.error('Get hybrid info failed:', error);
        res.status(500).json({
            message: 'Unable to retrieve hybrid info',
            success: false
        });
        return;
    }
}