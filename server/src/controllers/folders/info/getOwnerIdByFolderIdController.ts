import { Response } from 'express';
import getOwnerIdByFolderIdService from '../../../services/folders/info/getOwnerIdByFolderIdService';
import { ApiErrorResponse, AuthenticatedRequest, ApiSuccessResponse } from '../../../types';
import { isUuidV4 } from "../../../utils/validators";

export default async function getOwnerIdByFolderIdController(
    req: AuthenticatedRequest,
    res: Response<ApiSuccessResponse<{ owner_id: string }> | ApiErrorResponse>) {
    
    const folder_id = req.params.folderId;
    const user_id = req.user?.id;

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
        const owner_id = await getOwnerIdByFolderIdService(folder_id);
        res.json({ success: true, data: { owner_id }, message: 'Owner ID retrieved successfully' });
    } catch (error) {
        console.error('Get owner ID by folder ID failed:', error);
        res.status(500).json({ success: false, message: 'Unable to retrieve owner ID' });
    }
}

