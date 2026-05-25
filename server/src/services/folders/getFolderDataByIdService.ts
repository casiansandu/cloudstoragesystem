import db from '../../db/db';
import { and, eq } from 'drizzle-orm';
import { folders } from '../../db/schema';

export async function getFolderDataByIdService(user_id: string, folder_id: string): Promise<{ folder_id: string, parent_id: string | null, encrypted_key_data: string, encrypted_name_data: string | null }> {
    // Legacy SQL: SELECT encrypted_key_data, encrypted_name_data FROM folders WHERE id = $1 AND owner_id = $2
    const [result] = await db
        .select({ folder_id: folders.id, parent_id: folders.parentId, encrypted_key_data: folders.encryptedKeyData, encrypted_name_data: folders.encryptedNameData })
        .from(folders)
        .where(and(eq(folders.id, folder_id), eq(folders.ownerId, user_id)))
        .limit(1);

    if (!result) {
        throw new Error('Folder key not found for the specified folder and user.');
    }

    return { folder_id: result.folder_id, parent_id: result.parent_id, encrypted_key_data: result.encrypted_key_data, encrypted_name_data: result.encrypted_name_data };
}