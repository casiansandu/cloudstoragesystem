import db from "../db/db";


async function getAllUserFilesService(owner_id: string): Promise<Array<{id: string, name: string}>> {

    if (!owner_id) {
        throw new Error('User not found');
    }

    const files = await db.manyOrNone<{id: string, enc_name: string}>(
        'SELECT f.id, f.enc_name FROM files f join user_access ua ON f.id = ua.file_id WHERE ua.user_id = $1',
        [owner_id]
    );

    return files.map(file => ({ id: file.id, name: file.enc_name }));
}

export default getAllUserFilesService;