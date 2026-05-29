
import { Request, Response } from "express";
import { ApiErrorResponse, ApiSuccessResponse, AuthenticatedRequest } from "../../types";
import * as fs from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import path from 'node:path';
import { getStoragePath } from "../../utils/getStoragePath";
import hasAccessToFileService from "../../services/storage/hasAccessToFileService";
import { getFileContextService } from "../../services/storage/getFileContextService";
import { getFolderAccessForUserService } from "../../services/folders/getFolderAccessForUserService";
import { isUuidV4 } from "../../utils/validators";


export default async function getChunkController(
    req: AuthenticatedRequest, 
    res: Response<ApiSuccessResponse<any> | ApiErrorResponse>
): Promise<void> {
    const chunkId = req.params.chunk_id;
    const file_id = req.params.file_id;
    if (!chunkId) {
        res.status(400).json({ message: 'Missing chunk ID', success: false });
        return;
    }
    if (!file_id) {
        res.status(400).json({ message: 'Missing file ID', success: false });
        return;
    }
    if (!isUuidV4(chunkId)) {
        res.status(400).json({ message: 'Invalid chunk ID', success: false });
        return;
    }
    if (!isUuidV4(file_id)) {
        res.status(400).json({ message: 'Invalid file ID', success: false });
        return;
    }
    const user = req.user;
    if (!user) {
        res.status(401).json({ message: 'Unauthorized', success: false });
        return;
    }

    try {
        const has_access = await hasAccessToFileService(user.id, file_id);

        if (!has_access) {
            const file_context = await getFileContextService(file_id);
            if (file_context.owner_id !== user.id && file_context.folder_id) {
                try {
                    const access = await getFolderAccessForUserService(user.id, file_context.folder_id);
                    if (access.accessType !== "owner" && !access.permissions.can_download) {
                        res.status(403).json({ message: 'Access denied, missing download permission.', success: false });
                        return;
                    }
                } catch (access_error) {
                    const message = access_error instanceof Error ? access_error.message : "";
                    if (message === "Folder not found") {
                        res.status(404).json({ message, success: false });
                        return;
                    }
                }
            } else {
                res.status(403).json({ message: 'Access denied', success: false });
                return;
            }
        }


        const chunkPath = path.join(getStoragePath(file_id), chunkId);
        
        await fs.access(chunkPath);

        res.setHeader('Content-Type', 'application/octet-stream');

        const stream = createReadStream(chunkPath);
        
        stream.on('error', (err) => {
            console.error("Stream error:", err);
            res.status(500).json({ message: 'Error reading chunk', success: false });
        });

        stream.pipe(res);

    } catch (error) {
        console.error("File not found or access denied:", error);
        res.status(404).json({ message: 'Chunk not found', success: false });
        return;
    }
}
