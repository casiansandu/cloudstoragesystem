import { Response } from 'express';
import getOwnerIdByFileIdService from '../../../services/files/info/getOwnerIdByFileIdService';
import { ApiErrorResponse, AuthenticatedRequest, ApiSuccessResponse } from '../../../types';
import { isUuidV4 } from "../../../utils/validators";

export default async function getOwnerIdByFileIdController(
    req: AuthenticatedRequest,
    res: Response<ApiSuccessResponse<{ owner_id: string }> | ApiErrorResponse>) {
    
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
        const owner_id = await getOwnerIdByFileIdService(file_id);
        res.json({ success: true, data: { owner_id }, message: 'Owner ID retrieved successfully' });
    } catch (error) {
        console.error('Get owner ID by file ID failed:', error);
        res.status(500).json({ success: false, message: 'Unable to retrieve owner ID' });
    }
}

