import db from '../../db/db';
import { and, eq } from 'drizzle-orm';
import { folders } from '../../db/schema';
import { isUuidV4 } from '../../utils/validators';

export async function getFoldersInfoByParentService(user_id: string, parent_folder_id: string): 
    Promise<{ id: string, encrypted_name_data: string, encrypted_key_data: string }[]> {


    if (!isUuidV4(parent_folder_id)) {
        throw new Error('Invalid folder ID');
    }

    if (!isUuidV4(user_id)) {
        throw new Error('Invalid user ID');
    }
    // Legacy SQL: SELECT id, encrypted_name_data, encrypted_key_data FROM folders WHERE owner_id = $1 AND parent_id = $2
    const result = await db
        .select({
            id: folders.id,
            encrypted_name_data: folders.encryptedNameData,
            encrypted_key_data: folders.encryptedKeyData,
        })
        .from(folders)
        .where(and(eq(folders.ownerId, user_id), eq(folders.parentId, parent_folder_id)));

    return result.map((row) => ({
        id: row.id,
        encrypted_name_data: row.encrypted_name_data ?? '',
        encrypted_key_data: row.encrypted_key_data,
    }));
}
    