import db from "../../../db/db";
import { getStoragePath } from "../../../utils/getStoragePath";
import fs from 'node:fs/promises';
import { eq, sql } from 'drizzle-orm';
import { files, userAccess, users } from '../../../db/schema';

export default async function deleteFileService(
    user_id: string,
    file_id: string,
    allow_shared_delete: boolean = false
): Promise<void> {
    
    const [file] = await db
        .select({ id: files.id, owner_id: files.ownerId, fileSize: files.fileSize })
        .from(files)
        .where(eq(files.id, file_id))
        .limit(1);

    if (!file) {
        throw new Error('File not found');
    }

    if (!allow_shared_delete && file.owner_id !== user_id) {
        throw new Error('Access denied');
    }

    try {
        await db.transaction(async (tx) => {
            await tx.delete(userAccess).where(eq(userAccess.fileId, file_id));

            await tx.delete(files).where(eq(files.id, file_id));

            await tx
                .update(users)
                .set({ 
                    usedSpace: sql`GREATEST(0, ${users.usedSpace} - ${file.fileSize})` 
                })
                .where(eq(users.id, file.owner_id));
        });
    } catch (dbError) {
        console.error('Database deletion failed, transaction rolled back:', dbError);
        throw new Error('Unable to complete database records deletion');
    }

    try {
        const folderPath = getStoragePath(file_id);
        await fs.rm(folderPath, { recursive: true, force: true });
    } catch (fsError) {
        console.error(`[CRITICAL SYNC ERROR] DB record for file ${file_id} was deleted, but filesystem cleanup failed:`, fsError);
    }
}