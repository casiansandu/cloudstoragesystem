import { ApiErrorResponse, ApiSuccessResponse, AuthenticatedRequest } from "../../types";
import { Response } from 'express';
import deleteFileService from "../../services/storage/deleteFileService";
import isFileOwnerService from "../../services/storage/isFileOwnerService";

async function deleteFileController(req: AuthenticatedRequest, res: Response<ApiSuccessResponse<any> | ApiErrorResponse>): Promise<void> {
    
    const userId = req.user?.id;

    if (!userId) {
        res.status(401).json({
            message: 'Unauthorized',
            success: false
        });
        return;
    }

    const fileId = req.params.file_id;

    if (!fileId) {
        res.status(400).json({
            message: 'Bad Request: fileId is required',
            success: false
        });
        return;
    }

    try {
        const is_owner = await isFileOwnerService(userId, fileId);

        if (!is_owner) {
            res.status(403).json({
                message: 'Forbidden: You do not own this file',
                success: false
            });
            return;
        }
        await deleteFileService(userId, fileId);

        res.status(200).json({
            message: 'File deleted successfully',
            success: true
        });

        return;
        
    } catch (error) {
        res.status(500).json({
            message: "Unable to delete file",
            success: false,
            error: (error as Error).message
        });
    }
}

export default deleteFileController;