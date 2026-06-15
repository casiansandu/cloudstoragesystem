import { Response } from 'express';
import getSignatureForFileService from '../../../services/files/share/getSignatureForFileService';
import { ApiErrorResponse, AuthenticatedRequest, ApiSuccessResponse } from '../../../types';
import { isUuidV4 } from "../../../utils/validators";

export default async function getSignatureController(
    req: AuthenticatedRequest,
    res: Response<ApiSuccessResponse<{ signature: string }> | ApiErrorResponse>) {
    
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
        const signature = await getSignatureForFileService(user_id, file_id);
        res.json({ success: true, data: { signature }, message: 'Signature retrieved successfully' });
    } catch (error) {
        console.error('Get signature failed:', error);
        res.status(500).json({ success: false, message: 'Unable to retrieve signature' });
    }
}

