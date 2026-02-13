import { Response } from 'express';
import { getFolderKeyService } from '../../services/folders/getFolderKeyService';
import { ApiErrorResponse, AuthenticatedRequest, ApiSuccessResponse } from '../../types';

export async function getFolderKeyController(
    req: AuthenticatedRequest,
    res: Response<ApiSuccessResponse<{ encrypted_key_data: string }> | ApiErrorResponse>
): Promise<void> {
    const folder_id = req.params.folderId;
    const user_id = req.user?.id;

    if (!user_id || !folder_id) {
        res.status(400).json({
            message: 'Missing required fields: user_id and folder_id are required.',
            success: false
        });
        return;
    }

    try {
        const folder_key = await getFolderKeyService(user_id, folder_id);

        res.status(200).json({
            message: 'Folder key retrieved successfully',
            data: { encrypted_key_data: folder_key.encrypted_key_data },
            success: true
        });
    } catch (error) {
        res.status(500).json({
            message: (error as Error).message,
            success: false
        });
    }
}

export default getFolderKeyController;
