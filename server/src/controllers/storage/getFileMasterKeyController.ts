import { Response } from "express";
import { ApiErrorResponse, ApiSuccessResponse, AuthenticatedRequest, GetFileMasterKeyResult } from "../../types";
import getFileMasterKeyService from '../../services/storage/getFileMasterKeyService';
import hasAccessToFileService from "../../services/storage/hasAccessToFileService";
import { getFileContextService } from "../../services/storage/getFileContextService";
import { getFolderAccessForUserService } from "../../services/folders/getFolderAccessForUserService";
import { isUuidV4 } from "../../utils/validators";

async function getFileMasterKeyController(req: AuthenticatedRequest, res: Response<ApiSuccessResponse<GetFileMasterKeyResult> | ApiErrorResponse>): Promise<void> {
    
    const file_id = req.params.file_id;
    const user_id = req.user!.id;

    if (!file_id || !user_id) {
        res.status(400).json({
            message: 'Missing file_id or user_id',
            success: false
        });
        return;
    }

    if (!isUuidV4(file_id)) {
        res.status(400).json({ message: 'Invalid file ID', success: false });
        return;
    }

    try {
        const hasaccess = await hasAccessToFileService(user_id, file_id);
        if (!hasaccess) {
            res.status(403).json({
                message: 'Access denied: user is not the owner of the file',
                success: false
            });
            return;
        }

        const file_context = await getFileContextService(file_id);
        if (file_context.owner_id !== user_id && file_context.folder_id) {
            try {
                const access = await getFolderAccessForUserService(user_id, file_context.folder_id);
                if (access.accessType !== "owner" && !access.permissions.can_download) {
                    res.status(403).json({ message: 'Access denied: missing download permission', success: false });
                    return;
                }
            } catch (access_error) {
                const message = access_error instanceof Error ? access_error.message : "";
                if (message === "Folder not found") {
                    res.status(404).json({ message, success: false });
                    return;
                }
            }
        }

        const masterKey = await getFileMasterKeyService(user_id, file_id);    
        
        res.status(200).json({ 
            message: 'File master key retrieved successfully',
            data: {
                encrypted_file_key: masterKey,
            }, 
            success: true });
        return;
    } catch (error) {
        const message = error instanceof Error ? error.message : "Unable to retrieve file master key";
        if (message === "File not found") {
            res.status(404).json({ message, success: false });
            return;
        }

        if (message === "Access denied") {
            res.status(403).json({ message, success: false });
            return;
        }

        console.error('Get file master key failed:', error);
        res.status(500).json({
            message: 'Unable to retrieve file master key',
            success: false
        });
        return;
    }
}

export default getFileMasterKeyController;