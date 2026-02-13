import db from '../../db/db';

export default async function getFilesInfoByFolderService(user_id: string, folder_id: string): Promise<{ id: string, encrypted_name_data: string, encrypted_key_data: string }[]> {

    const result = await db.manyOrNone(
        `SELECT f.id, f.encrypted_name_data, ua.encrypted_file_key AS encrypted_key_data
         FROM files f JOIN user_access ua ON f.id = ua.file_id
         WHERE f.folder_id = $1 AND ua.user_id = $2 and ua.mlkem_ciphertext IS NULL`,
        [folder_id, user_id]
    );

    return result;
}
