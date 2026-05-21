import { Response } from "express";
import { ApiErrorResponse, ApiSuccessResponse, FileUploadRequest } from "../../types";
import uploadChunkService from "../../services/storage/uploadChunkService";
import isFileOwnerService from "../../services/storage/isFileOwnerService";

interface ChunkUploadSuccess {
    stored_bytes: number;
}

const MAX_CHUNK_SIZE_BYTES = 5 * 1024 * 1024;

export async function uploadController(
    req: FileUploadRequest, 
    res: Response<ApiSuccessResponse<ChunkUploadSuccess> | ApiErrorResponse>
): Promise<void> {
    const id = req.user?.id;
    const file_id = req.params.file_id;
    const chunk_id = req.params.chunk_id;

    if (!id) {
        res.status(401).json({ message: 'Unauthorized', success: false });
        return;
    }

    if (!file_id || !req.body || !chunk_id) {
        res.status(400).json({ message: 'Missing parameters', success: false });
        return;
    }

    const chunkSize = req.body.byteLength;
    if (chunkSize <= 0 || chunkSize > MAX_CHUNK_SIZE_BYTES) {
        res.status(400).json({ message: 'Invalid chunk size', success: false });
        return;
    }

    try {

        const is_file_owner = await isFileOwnerService(id, file_id);

        if (!is_file_owner) {
            res.status(403).json({
                message: 'Access denied, not file owner.',
                success: false
            });
            return;
        }

        const stored_bytes = await uploadChunkService(req.body, file_id, chunk_id);
        
        res.status(200).json({ message: 'Chunk received', success: true, data: { stored_bytes } });
        return;
    } catch (error) {
        console.error('Upload chunk failed:', error);
        res.status(500).json({ message: 'Unable to upload chunk', success: false });
        return;
    }
}