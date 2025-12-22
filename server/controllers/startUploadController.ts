import { ApiErrorResponse, ApiSuccessResponse, StartFileUploadRequest } from "../types";
import startUploadService from "../services/startUploadService";
import { Response } from "express";

interface StartUploadData {
    file_id: string;
}

export async function startUploadController(
    req: StartFileUploadRequest,
    res: Response<ApiSuccessResponse<StartUploadData> | ApiErrorResponse>
): Promise<void> {
    
    const id = req.user?.id;

    if (!id || !req.body.path || !req.body.file_size) {
        res.status(400).json({ message: 'Missing parameters', success: false });
        return;
    }
    
    try {
        const file_id = await startUploadService(req.body.name, id, req.body.path, req.body.file_size);

        res.status(200).json({ message: 'Upload started', success: true, data: { file_id } });
        return;
    } catch (error) {
        res.status(500).json({ message: (error as Error).message, success: false });
        return;
    }
        
} 