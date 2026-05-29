import db from "../../db/db";
import { getStoragePath } from "../../utils/getStoragePath";
import fs from 'node:fs/promises';
import { eq } from 'drizzle-orm';
import { files, userAccess } from '../../db/schema';

export default async function deleteFileService(
    user_id: string,
    file_id: string,
    allow_shared_delete: boolean = false
): Promise<void> {
    // Legacy SQL: SELECT * FROM files WHERE id = $1 AND owner_id = $2
    const [file] = await db
        .select({ id: files.id, owner_id: files.ownerId })
        .from(files)
        .where(eq(files.id, file_id))
        .limit(1);

    if (!file) {
        throw new Error('File not found');
    }

    if (!allow_shared_delete && file.owner_id !== user_id) {
        throw new Error('Access denied');
    }

    const folderPath = getStoragePath(file_id);

    await fs.rm(folderPath, { recursive: true, force: true });
        

    // Legacy SQL: DELETE FROM user_access WHERE file_id = $1
    await db.delete(userAccess).where(eq(userAccess.fileId, file_id));

    // Legacy SQL: DELETE FROM files WHERE id = $1
    await db.delete(files).where(eq(files.id, file_id));
}