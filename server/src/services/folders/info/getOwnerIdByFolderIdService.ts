import db from '../../../db/db';
import { and, eq, isNull } from 'drizzle-orm';
import { folders, userAccess } from '../../../db/schema';

export default async function getOwnerIdByFolderIdService(folder_id: string): Promise<string> {
    const result = await db
        .select({ owner_id: folders.ownerId })
        .from(folders)
        .where(eq(folders.id, folder_id));

    if (result.length === 0) {
        throw new Error('Folder not found');
    }

    return result[0].owner_id;
}