import { ApiErrorResponse, ApiSuccessResponse, ShareFileRequest } from "../types";
import { Response } from "express";
import { shareFileService } from "../services/fileShareService";

type FileRequestResult = {
    file_access_id: string;
}

export async function shareFileController(req: ShareFileRequest, res: Response<ApiSuccessResponse<FileRequestResult> | ApiErrorResponse>): Promise<void> {

    const { file_id, recipient_username, encrypted_file_key, encrypted_manifest_key } = req.body;

    if (!file_id || !recipient_username || !encrypted_file_key || !encrypted_manifest_key) {
        res.status(400).json({
            message: 'Missing required fields',
            success: false
        });
        return;
    }

    try {
        const access_id = await shareFileService(file_id, recipient_username, encrypted_file_key, encrypted_manifest_key);
        res.status(200).json({
            message: 'File shared successfully',
            success: true,
            data: {
                file_access_id: access_id
            }
        });
        return;
    } catch (error) {
        res.status(500).json({
            message: (error as Error).message,
            success: false
        });
        return;
    }
}