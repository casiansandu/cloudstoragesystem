import db from '../../db/db';

export async function getFoldersInfoByParentService(user_id: string, folder_id: string): 
    Promise<{ id: string, encrypted_name_data: string, encrypted_key_data: string }[]> {

    const result = await db.manyOrNone(
        'SELECT id, encrypted_name_data, encrypted_key_data FROM folders WHERE owner_id = $1 AND parent_id = $2',
        [user_id, folder_id]
    );

    return result;
}
    