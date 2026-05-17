import { ApiErrorResponse, ApiSuccessResponse, ShareFileHybridRequest } from "../../types";
import { Response } from "express";
import { shareFileHybridService } from "../../services/storage/shareFileHybridService";

type FileRequestResult = {
    file_access_id: string;
}

export async function shareFileHybridController(req: ShareFileHybridRequest, res: Response<ApiSuccessResponse<FileRequestResult> | ApiErrorResponse>): Promise<void> {

    const { file_id, recipient_username, encrypted_file_key, share_duration, mlkem_ciphertext, x25519_ephemeral_public } = req.body;

    if (!file_id || !recipient_username || !encrypted_file_key ||
         (share_duration === undefined || share_duration === null) || !mlkem_ciphertext || !x25519_ephemeral_public) {
        res.status(400).json({
            message: 'Missing required fields',
            success: false
        });
        return;
    }

    try {
        const access_id = await shareFileHybridService(file_id, recipient_username, encrypted_file_key, share_duration, mlkem_ciphertext, x25519_ephemeral_public);
        res.status(200).json({
            message: 'File shared successfully',
            success: true,
            data: {
                file_access_id: access_id
            }
        });
        return;
    } catch (error) {
        res.status(500).json({
            message: (error as Error).message,
            success: false
        });
        return;
    }
}