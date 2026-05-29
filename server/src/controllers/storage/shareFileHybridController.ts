import { ApiErrorResponse, ApiSuccessResponse, ShareFileHybridRequest } from "../../types";
import { Response } from "express";
import { shareFileHybridService } from "../../services/storage/shareFileHybridService";
import { getFileContextService } from "../../services/storage/getFileContextService";
import { getFolderAccessForUserService } from "../../services/folders/getFolderAccessForUserService";
import { isUuidV4 } from "../../utils/validators";

type FileRequestResult = {
    file_access_id: string;
}

export async function shareFileHybridController(req: ShareFileHybridRequest, res: Response<ApiSuccessResponse<FileRequestResult> | ApiErrorResponse>): Promise<void> {


    const user = req.user;

    if (!user) {
        res.status(401).json({
            message: 'Unauthorized',
            success: false
        });
        return;
    }

    const { file_id, recipient_username, encrypted_file_key, share_duration, mlkem_ciphertext, x25519_ephemeral_public } = req.body;

    if (!file_id || !recipient_username || !encrypted_file_key ||
         (share_duration === undefined || share_duration === null) || !mlkem_ciphertext || !x25519_ephemeral_public) {
        res.status(400).json({
            message: 'Missing required fields',
            success: false
        });
        return;
    }

    if (!isUuidV4(file_id)) {
        res.status(400).json({ message: 'Invalid file ID', success: false });
        return;
    }

    try {
        const file_context = await getFileContextService(file_id);
        if (file_context.owner_id !== user.id) {
            if (!file_context.folder_id) {
                res.status(403).json({ message: 'Access denied, not file owner.', success: false });
                return;
            }

            const access = await getFolderAccessForUserService(user.id, file_context.folder_id);
            if (access.accessType !== "owner" && !access.permissions.can_share) {
                res.status(403).json({ message: 'Access denied, missing share permission.', success: false });
                return;
            }
        }

        const access_id = await shareFileHybridService(file_id, recipient_username, encrypted_file_key, share_duration, mlkem_ciphertext, x25519_ephemeral_public);
        res.status(200).json({
            message: 'File shared successfully',
            success: true,
            data: {
                file_access_id: access_id
            }
        });
        return;
    } catch (error) {
        const message = error instanceof Error ? error.message : "Unable to share file";
        if (message === "Folder not found") {
            res.status(404).json({ message, success: false });
            return;
        }

        if (message === "Access denied") {
            res.status(403).json({ message, success: false });
            return;
        }

        console.error('Share file failed:', error);
        res.status(500).json({
            message: 'Unable to share file',
            success: false
        });
        return;
    }
}