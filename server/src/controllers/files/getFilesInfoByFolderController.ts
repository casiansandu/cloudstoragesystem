import { Response } from 'express';
import getFilesInfoByFolderService from '../../services/files/getFilesInfoByFolderService';
import { ApiErrorResponse, AuthenticatedRequest, ApiSuccessResponse } from '../../types';
import { isUuidV4 } from "../../utils/validators";

export default async function getFilesInfoByFolderController(
    req: AuthenticatedRequest,
    res: Response<ApiSuccessResponse<{ files: { id: string, encrypted_name_data: string, encrypted_key_data: string }[] }> | ApiErrorResponse>) {
    
    const folder_id = req.params.folderId;
    const user_id = req.user!.id;

    if (!user_id) {
        res.status(401).json({ success: false, message: 'Unauthorized' });
        return;
    }
    if (!folder_id) {
        res.status(400).json({ success: false, message: 'Folder ID is required' });
        return;
    }

    if (!isUuidV4(folder_id)) {
        res.status(400).json({ success: false, message: 'Invalid folder ID' });
        return;
    }

    try {
        const files = await getFilesInfoByFolderService(user_id, folder_id);
        res.json({ success: true, data: { files }, message: 'Files retrieved successfully' });
    } catch (error) {
        console.error('Get files by folder failed:', error);
        res.status(500).json({ success: false, message: 'Unable to retrieve files' });
    }
}