import db from '../../db/db';

export async function createFolderService(
    user_id: string, 
    encrypted_key_data: string, 
    parent_folder_id?: string, 
    encrypted_folder_name_data?: string
): Promise<{ folder_id: string }> {

    const { folder_id } = await db.one(
        'INSERT INTO folders (parent_id, encrypted_name_data, encrypted_key_data, owner_id) VALUES ($1, $2, $3, $4) RETURNING id',
        [parent_folder_id || null, encrypted_folder_name_data || null, encrypted_key_data, user_id]
    );

    console.log(`Created folder with ID: ${folder_id} for user: ${user_id}`);
    
    return { folder_id };
}