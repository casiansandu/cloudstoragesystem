
import { Response } from 'express';
import { ApiErrorResponse, ApiSuccessResponse, AuthenticatedRequest, HybridInfoResult } from "../../types";
import { getIdByUsername } from '../../services/users/getIdByUsername';
import { getHybridInfoService } from '../../services/storage/getHybridInfoService';

export async function getHybridInfoController(req: AuthenticatedRequest, res: Response<ApiSuccessResponse<HybridInfoResult> | ApiErrorResponse>): Promise<void> {
    
    const username = req.user!.username;
    const fileId = req.params.file_id;

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
        res.status(500).json({
            message: (error as Error).message,
            success: false
        });
        return;
    }
}