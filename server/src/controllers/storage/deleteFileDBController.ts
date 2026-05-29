import { ApiErrorResponse, ApiSuccessResponse, AuthenticatedRequest } from "../../types";
import { Response } from 'express';
import deleteFileService from "../../services/storage/deleteFileService";
import { getFileContextService } from "../../services/storage/getFileContextService";
import { getFolderAccessForUserService } from "../../services/folders/getFolderAccessForUserService";
import { isUuidV4 } from "../../utils/validators";

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

    if (!isUuidV4(fileId)) {
        res.status(400).json({ message: 'Invalid file ID', success: false });
        return;
    }

    try {
        const file_context = await getFileContextService(fileId);
        let allow_shared_delete = false;

        if (file_context.owner_id !== userId) {
            if (!file_context.folder_id) {
                res.status(403).json({ message: 'Forbidden: You do not own this file', success: false });
                return;
            }

            const access = await getFolderAccessForUserService(userId, file_context.folder_id);
            if (access.accessType !== "owner" && !access.permissions.can_delete) {
                res.status(403).json({ message: 'Access denied, missing delete permission.', success: false });
                return;
            }

            allow_shared_delete = true;
        }

        await deleteFileService(userId, fileId, allow_shared_delete);

        res.status(200).json({
            message: 'File deleted successfully',
            success: true
        });

        return;
        
    } catch (error) {
        const message = error instanceof Error ? error.message : "Unable to delete file";
        if (message === "File not found") {
            res.status(404).json({ message, success: false });
            return;
        }

        if (message === "Access denied" || message === "Folder not found") {
            res.status(403).json({ message, success: false });
            return;
        }

        console.error('Delete file failed:', error);
        res.status(500).json({
            message: "Unable to delete file",
            success: false
        });
    }
}

export default deleteFileController;