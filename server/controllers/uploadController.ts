import { Response } from "express";
import { ApiErrorResponse, ApiSuccessResponse, FileUploadRequest } from "../types";
import uploadChunkService from "../services/uploadChunkService";

interface chunkUploadSuccess {
    stored_bytes: number;
}

export async function uploadController(
    req: FileUploadRequest, 
    res: Response<ApiSuccessResponse<chunkUploadSuccess> | ApiErrorResponse>): Promise<void> {
    const id = req.user?.id;
    const chunk_id = req.header('X-Chunk-ID');

    if (!id || !req.body || !chunk_id) {
        res.status(400).json({ message: 'Missing parameters', success: false });
        return;
    }

    try {
        const stored_bytes = await uploadChunkService(req.body, chunk_id);
        
        res.status(200).json({ message: 'Chunk received', success: true, data: { stored_bytes } });
        return;
    } catch (error) {
        res.status(500).json({ message: (error as Error).message, success: false });
        return;
    }
}