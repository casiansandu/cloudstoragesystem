import db from "../db/db";
import { getStoragePath } from "../utils/getStoragePath";
import fs from 'fs/promises';

export default async function deleteFileService(user_id: string, file_id: string): Promise<void> {
    const file = await db.oneOrNone('SELECT * FROM files WHERE id = $1 AND owner_id = $2', [file_id, user_id]);

    if (!file) {
        throw new Error('File not found');
    }

    const folderPath = getStoragePath(file_id);

    await fs.rm(folderPath, { recursive: true, force: true });
        

    await db.none('DELETE FROM user_access WHERE file_id = $1', [file_id]);

    await db.none('DELETE FROM files WHERE id = $1', [file_id]);
}