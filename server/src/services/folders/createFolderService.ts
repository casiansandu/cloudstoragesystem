import db from '../../db/db';
import { and, eq } from 'drizzle-orm';
import { folders } from '../../db/schema';

export async function createFolderService(
    user_id: string, 
    encrypted_key_data: string, 
    parent_folder_id?: string, 
    encrypted_folder_name_data?: string
): Promise<{ folder_id: string }> {

    if (parent_folder_id) {
        const [parent] = await db
            .select({ id: folders.id })
            .from(folders)
            .where(and(eq(folders.id, parent_folder_id), eq(folders.ownerId, user_id)))
            .limit(1);

        if (!parent) {
            throw new Error('Parent folder not found or not owned by user');
        }
    }

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