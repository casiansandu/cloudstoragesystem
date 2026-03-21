import db from '../../db/db';

export async function getFolderKeyService(user_id: string, folder_id: string): Promise<{ encrypted_key_data: string }> {
    const result = await db.oneOrNone(
        'SELECT encrypted_key_data FROM folders WHERE id = $1 AND owner_id = $2',
        [folder_id, user_id]
    );

    if (!result) {
        throw new Error('Folder key not found for the specified folder and user.');
    }

    return { encrypted_key_data: result.encrypted_key_data };
}