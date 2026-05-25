
import { Response } from 'express';
import { ApiErrorResponse, ApiSuccessResponse, AuthenticatedRequest, HybridInfoResult } from "../../types";
import { getIdByUsername } from '../../services/users/getIdByUsername';
import { getHybridInfoService } from '../../services/storage/getHybridInfoService';
import { isUuidV4 } from "../../utils/validators";

export async function getHybridInfoController(req: AuthenticatedRequest, res: Response<ApiSuccessResponse<HybridInfoResult> | ApiErrorResponse>): Promise<void> {
    
    const username = req.user!.username;
    const fileId = req.params.file_id;

    if (!fileId) {
        res.status(400).json({ message: 'Missing file ID', success: false });
        return;
    }

    if (!isUuidV4(fileId)) {
        res.status(400).json({ message: 'Invalid file ID', success: false });
        return;
    }

    try {
        const id = await getIdByUsername(username);
        if (!id) {
            res.status(404).json({
                message: 'User not found',
                success: false
            });
            return;
        }
        const info = await getHybridInfoService(fileId, id);    
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