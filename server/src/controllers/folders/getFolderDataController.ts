import { Response } from 'express';
import { getFolderDataByIdService } from '../../services/folders/getFolderDataByIdService';
import { ApiErrorResponse, AuthenticatedRequest, ApiSuccessResponse } from '../../types';

export async function getFolderDataController(
    req: AuthenticatedRequest,
    res: Response<ApiSuccessResponse<{ folder_id: string, parent_id: string | null, encrypted_key_data: string, encrypted_name_data: string }> | ApiErrorResponse>
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
        const folder_info = await getFolderDataByIdService(user_id, folder_id);

        res.status(200).json({
            message: 'Folder data retrieved successfully',
            data: { 
                folder_id: folder_info.folder_id,
                parent_id: folder_info.parent_id,
                encrypted_key_data: folder_info.encrypted_key_data, 
                encrypted_name_data: folder_info.encrypted_name_data ?? "" },
            success: true
        });
    } catch (error) {
        res.status(500).json({
            message: (error as Error).message,
            success: false
        });
    }
}

export default getFolderDataController;
