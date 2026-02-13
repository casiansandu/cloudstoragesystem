import db from "../db/db";


async function getAllUserFilesService(owner_id: string): Promise<Array<{id: string, name: string}>> {

    if (!owner_id) {
        throw new Error('User not found');
    }

    const query_to_get = "SELECT f.id, f.encrypted_name_data FROM files f JOIN user_access ua ON f.id = ua.file_id WHERE ua.user_id = $1 AND (ua.share_duration = 0 OR ua.created_at + (ua.share_duration * INTERVAL '1 day') >= CURRENT_TIMESTAMP)";
    const query_to_delete = "DELETE FROM user_access WHERE user_id = $1 AND share_duration != 0 AND created_at + (share_duration * INTERVAL '1 day') < CURRENT_TIMESTAMP returning file_id";

    try {
        return await db.tx(async t => {
            const deletedFiles = await t.manyOrNone<{file_id: string}>(query_to_delete, [owner_id]);
            //console.log('Deleted expired access for files: ', deletedFiles);

            let files = await t.manyOrNone<{id: string, encrypted_name_data: string}>(
                query_to_get,
                [owner_id]
            );

            //console.log('Files retrieved: ', files);
            return files.map(file => ({ id: file.id, name: file.encrypted_name_data }));
        })
    }
    catch (error) {
        throw new Error('Failed to retrieve user files: ' + (error as Error).message);
    }
    
}

export default getAllUserFilesService;