import fs from 'node:fs/promises';
import { getStoragePath } from "../../../utils/getStoragePath";
import db from "../../../db/db";
import { sql } from 'drizzle-orm';
import { files } from '../../../db/schema';

async function uploadChunkService(bytes: Uint8Array<ArrayBufferLike>, file_id: string, chunk_id: string): Promise<number> {
    const chunkSize = bytes.byteLength;

    const [updatedFile] = await db
        .update(files)
        .set({ 
            uploadedBytes: sql`${files.uploadedBytes} + ${chunkSize}` 
        })
        .where(
            sql`${files.id} = ${file_id} AND ${files.uploadedBytes} + ${chunkSize} <= ${files.fileSize}`
        )
        .returning({ id: files.id });

    if (!updatedFile) {
        throw new Error('STORAGE_LIMIT_EXCEEDED');
    }

    try {
        const storagePath = getStoragePath(file_id);

        const chunkPath = `${storagePath}/${chunk_id}`;
        try {
            await fs.access(chunkPath);
            throw new Error("CHUNK_ALREADY_EXISTS");
        } catch (err) {
            await fs.writeFile(chunkPath, Buffer.from(bytes));
        }
        return chunkSize;
    } catch (fsError) {
        await db.update(files)
            .set({ uploadedBytes: sql`${files.uploadedBytes} - ${chunkSize}` })
            .where(sql`${files.id} = ${file_id}`);
            
        console.log('Failed to write chunk to disk:', fsError);
        throw new Error('Failed to write chunk to disk');
    }
}

export default uploadChunkService;