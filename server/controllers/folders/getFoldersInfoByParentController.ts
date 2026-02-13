import { Response } from 'express';
import { getFoldersInfoByParentService } from '../../services/folders/getFoldersInfoByParentService';
import { ApiErrorResponse, AuthenticatedRequest, ApiSuccessResponse } from '../../types';

export async function getFoldersInfoByParentController(
    req: AuthenticatedRequest,
    res: Response<ApiSuccessResponse<{ folders: { id: string, encrypted_name_data: string, encrypted_key_data: string }[] }> | ApiErrorResponse>
): Promise<void> {

    const parent_folder_id = req.params.folderId;
    const user_id = req.user?.id;
    
    if (!user_id) {
        res.status(401).json({ message: 'Unauthorized', success: false });
        return;
    }
    if (!parent_folder_id) {
        res.status(400).json({ message: 'Parent folder ID is required', success: false });
        return;
    }

    try {
        const folders = await getFoldersInfoByParentService(user_id, parent_folder_id);
        res.status(200).json({ success: true, data: { folders }, message: 'Folders retrieved successfully' });
        return;
    } catch (error) {
        res.status(500).json({ success: false, message: (error as Error).message });
        return;
    }
}