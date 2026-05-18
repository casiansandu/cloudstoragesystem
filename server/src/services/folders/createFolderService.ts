import db from '../../db/db';
import { folders } from '../../db/schema';

export async function createFolderService(
    user_id: string, 
    encrypted_key_data: string, 
    parent_folder_id?: string, 
    encrypted_folder_name_data?: string
): Promise<{ folder_id: string }> {

    // Legacy SQL: INSERT INTO folders (parent_id, encrypted_name_data, encrypted_key_data, owner_id) VALUES ($1, $2, $3, $4) RETURNING id
    const [insertedFolder] = await db
        .insert(folders)
        .values({
            parentId: parent_folder_id || null,
            encryptedNameData: encrypted_folder_name_data || null,
            encryptedKeyData: encrypted_key_data,
            ownerId: user_id,
        })
        .returning({ folder_id: folders.id });

    return { folder_id: insertedFolder.folder_id };
}