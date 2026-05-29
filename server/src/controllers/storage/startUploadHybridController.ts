import { ApiErrorResponse, ApiSuccessResponse, StartHybridFileUploadRequest } from "../../types";
import startHybridUploadService from "../../services/storage/startHybridUploadService";
import { Response } from "express";
import { getFolderAccessForUserService } from "../../services/folders/getFolderAccessForUserService";
import { isUuidV4 } from "../../utils/validators";

interface StartUploadDataResult {
    file_id: string;
    access_id: string;
}

export async function startHybridUploadController(
    req: StartHybridFileUploadRequest,
    res: Response<ApiSuccessResponse<StartUploadDataResult> | ApiErrorResponse>
): Promise<void> {
    const id = req.user?.id;
    if (!id) {
        res.status(401).json({ message: 'Unauthorized', success: false });
        return;
    }

    const {name, file_size, encrypted_file_key, share_duration, folder_id} = req.body;

    if (!name || !encrypted_file_key || (share_duration === undefined || share_duration === null) || !folder_id) {
        res.status(400).json({ message: 'Missing parameters', success: false });
        return;
    }

    if (!isUuidV4(folder_id)) {
        res.status(400).json({ message: 'Invalid folder ID', success: false });
        return;
    }

    if (typeof file_size !== 'number' || !Number.isFinite(file_size) || file_size <= 0) {
        res.status(400).json({ message: 'Invalid file size', success: false });
        return;
    }

    if (typeof share_duration !== 'number' || !Number.isFinite(share_duration) || share_duration < 0) {
        res.status(400).json({ message: 'Invalid share duration', success: false });
        return;
    }
    
    try {
        const access = await getFolderAccessForUserService(id, folder_id);
        if (access.accessType !== "owner" && !access.permissions.can_upload) {
            res.status(403).json({ message: 'Access denied, missing upload permission.', success: false });
            return;
        }

        const { file_id, access_id } = await startHybridUploadService(
            name, 
            id, 
            file_size, 
            encrypted_file_key, 
            share_duration,
            folder_id
        );

        res.status(200).json({ message: 'Upload started', success: true, data: { file_id, access_id } });
        return;
    } catch (error) {
        const message = error instanceof Error ? error.message : "Unable to start upload";
        if (message === "Folder not found") {
            res.status(404).json({ message, success: false });
            return;
        }

        if (message === "Access denied") {
            res.status(403).json({ message, success: false });
            return;
        }

        console.error('Start hybrid upload failed:', error);
        res.status(500).json({ message: 'Unable to start upload', success: false });
        return;
    }
        
} 