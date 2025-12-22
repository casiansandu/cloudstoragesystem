
import { Request, Response } from "express";
import { ApiErrorResponse, ApiSuccessResponse } from "../types";
import { FILESYSTEM_ROOT } from "../config/config";
import * as fs from 'node:fs/promises';
import { createReadStream } from 'fs'; // For the stream specifically
import path from 'path';


export default async function getChunkController(
    req: Request, 
    res: Response<ApiSuccessResponse<any> | ApiErrorResponse>
) {
    const chunkId = req.params.chunkId;
    if (!chunkId) {
        return res.status(400).json({ message: 'Missing chunk ID', success: false });
    }

    try {
        const chunkPath = path.join(FILESYSTEM_ROOT, chunkId.slice(0, 2), chunkId);
        //console.log("Chunk path:", chunkPath);
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
        res.status(404).json({ message: 'Chunk not found', success: false });
  }
}
