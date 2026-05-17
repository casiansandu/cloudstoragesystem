import db from '../../db/db';
import { and, eq } from 'drizzle-orm';
import { folders } from '../../db/schema';

export async function getFoldersInfoByParentService(user_id: string, folder_id: string): 
    Promise<{ id: string, encrypted_name_data: string, encrypted_key_data: string }[]> {

    // Legacy SQL: SELECT id, encrypted_name_data, encrypted_key_data FROM folders WHERE owner_id = $1 AND parent_id = $2
    const result = await db
        .select({
            id: folders.id,
            encrypted_name_data: folders.encryptedNameData,
            encrypted_key_data: folders.encryptedKeyData,
        })
        .from(folders)
        .where(and(eq(folders.ownerId, user_id), eq(folders.parentId, folder_id)));

    return result.map((row) => ({
        id: row.id,
        encrypted_name_data: row.encrypted_name_data ?? '',
        encrypted_key_data: row.encrypted_key_data,
    }));
}
    