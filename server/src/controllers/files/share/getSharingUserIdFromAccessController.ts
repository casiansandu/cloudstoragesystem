import { Response } from 'express';
import getSharingUserIdFromAccessService from '../../../services/files/share/getSharingUserIdFromAccessService';
import { ApiErrorResponse, AuthenticatedRequest, ApiSuccessResponse } from '../../../types';
import { isUuidV4 } from "../../../utils/validators";

export default async function getSharingUserIdFromAccessController(
    req: AuthenticatedRequest,
    res: Response<ApiSuccessResponse<{ sharing_user_id: string }> | ApiErrorResponse>) {
    
    const file_id = req.params.file_id;
    const user_id = req.user?.id;

    if (!user_id) {
        res.status(401).json({ success: false, message: 'Unauthorized' });
        return;
    }
    
    if (!file_id) {
        res.status(400).json({ success: false, message: 'File ID is required' });
        return;
    }

    if (!isUuidV4(file_id)) {
        res.status(400).json({ success: false, message: 'Invalid file ID' });
        return;
    }

    try {
        const sharing_user_id = await getSharingUserIdFromAccessService(user_id, file_id);
        res.json({ success: true, data: { sharing_user_id }, message: 'Sharing user ID retrieved successfully' });
    } catch (error) {
        console.error('Get sharing user ID from access failed:', error);
        res.status(500).json({ success: false, message: 'Unable to retrieve sharing user ID' });
    }
}

