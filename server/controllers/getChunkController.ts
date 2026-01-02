
import { Request, Response } from "express";
import { ApiErrorResponse, ApiSuccessResponse } from "../types";
import * as fs from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import path from 'node:path';
import { getStoragePath } from "../utils/getStoragePath";


export default async function getChunkController(
    req: Request, 
    res: Response<ApiSuccessResponse<any> | ApiErrorResponse>
) {
    const chunkId = req.params.chunk_id;
    if (!chunkId) {
        return res.status(400).json({ message: 'Missing chunk ID', success: false });
    }

    try {
        const file_id = req.params.file_id;

        const chunkPath = path.join(getStoragePath(file_id), chunkId);
        
        await fs.access(chunkPath);

        res.setHeader('Content-Type', 'application/octet-stream');

        const stream = createReadStream(chunkPath);
        
        stream.on('error', (err) => {
            console.error("Stream error:", err);
            return res.status(500).json({ message: 'Error reading chunk', success: false });
        });

        stream.pipe(res);

    } catch (error) {
        console.error("File not found or access denied:", error);
        return res.status(404).json({ message: 'Chunk not found', success: false });
  }
}
