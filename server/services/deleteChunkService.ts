import fs from 'fs/promises';
import path from 'path';
import db from '../db/db';

async function deleteChunkService(chunkId: string): Promise<void> {
    
    const chunk = await db.oneOrNone('SELECT * FROM file_chunks WHERE id = $1', [chunkId]);

    if (!chunk) {
        throw new Error('Chunk not found');
    }



}