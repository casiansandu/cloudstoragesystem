import { Response } from 'express';
import getSignatureForFolderService from '../../../services/folders/share/getSignatureForFolderService';
import { ApiErrorResponse, AuthenticatedRequest, ApiSuccessResponse } from '../../../types';
import { isUuidV4 } from "../../../utils/validators";

export default async function getSignatureForFolderController(
    req: AuthenticatedRequest,
    res: Response<ApiSuccessResponse<{ signature: string }> | ApiErrorResponse>) {
    
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
        const signature = await getSignatureForFolderService(user_id, folder_id);
        res.json({ success: true, data: { signature }, message: 'Signature retrieved successfully' });
    } catch (error) {
        console.error('Get signature failed:', error);
        res.status(500).json({ success: false, message: 'Unable to retrieve signature' });
    }
}

