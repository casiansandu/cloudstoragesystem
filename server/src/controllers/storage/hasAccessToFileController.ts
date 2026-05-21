import { Response } from "express";
import { ApiErrorResponse, ApiSuccessResponse, AuthenticatedRequest } from "../../types";
import hasAccessToFileService from '../../services/storage/hasAccessToFileService';

type FileAccessResult = {
    access_id: string;
}

async function hasAccessToFileController(
    req: AuthenticatedRequest, 
    res: Response<ApiSuccessResponse<FileAccessResult> | ApiErrorResponse>): Promise<void> {
    
    const file_id = req.params.file_id;
    const user_id = req.user!.id;

    if (!file_id || !user_id) {
        res.status(400).json({
            message: 'Missing file_id or user_id',
            success: false
        });
        return;
    }

    try {
        const access_id = await hasAccessToFileService(user_id, file_id);
        if (!access_id) {
            res.status(403).json({
                message: 'Access denied: user does not have access to the file',
                success: false
            });
            return;
        }
        res.status(200).json({ 
            message: 'File access check completed successfully',
            data: {
                access_id: access_id,
            },
            success: true
        });
        return;
    } catch (error) {
        console.error('Check file access failed:', error);
        res.status(500).json({
            message: 'Unable to check file access',
            success: false
        });
        return;
    }
}

export default hasAccessToFileController;