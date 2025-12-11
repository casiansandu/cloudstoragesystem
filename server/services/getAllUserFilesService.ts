import db from "../db/db";


async function getAllUserFilesService(username: string): Promise<Array<{filename: string}>> {
    
    const owner_id = await db.oneOrNone<{id: number}>(
        'SELECT id FROM srp_users WHERE username = $1',
        [username]
    );

    if (!owner_id) {
        throw new Error('User not found');
    }

    const files = await db.manyOrNone<{filename: string}>(
        'SELECT enc_name FROM files WHERE owner_id = $1',
        [owner_id.id]
    );

    const file1 = "file1";
    const file2 = "file2";  
    const file3 = "file3";

    return [{filename: file1}, {filename: file2}, {filename: file3}];
}

export default getAllUserFilesService;