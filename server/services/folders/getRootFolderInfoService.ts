import db from '../../db/db';


export async function getRootFolderIdService(user_id: string): Promise<{ root_folder_id: string }> {
    const result = await db.oneOrNone(
        'SELECT id FROM folders WHERE owner_id = $1 AND parent_id IS NULL',
        [user_id]
    );

    if (!result) {
        throw new Error('Root folder id not found for the specified user.');
    }

    return { root_folder_id: result.id };
}