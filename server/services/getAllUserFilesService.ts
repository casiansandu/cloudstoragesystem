import db from "../db/db";


async function getAllUserFilesService(owner_id: string): Promise<Array<{id: string, name: string}>> {

    if (!owner_id) {
        throw new Error('User not found');
    }

    const files = await db.manyOrNone<{id: string, enc_name: string}>(
        'SELECT id, enc_name FROM files WHERE owner_id = $1',
        [owner_id]
    );


    return files.map(file => ({ id: file.id, name: file.enc_name }));
}

export default getAllUserFilesService;