import db from "../db/db";

import {GetFileKeysResult} from "../types";

async function getAllUserFileKeysService(user_id: string): Promise<Array<GetFileKeysResult>> {

    const result = await db.manyOrNone<GetFileKeysResult>(
        `SELECT file_id, encrypted_file_key, encrypted_manifest_key FROM user_access WHERE user_id = $1`,
        [user_id]
    );
    
    const res = result.map(item => ({
        file_id: item.file_id,
        encrypted_file_key: item.encrypted_file_key,
        encrypted_manifest_key: item.encrypted_manifest_key
    }));

    return res;
}

export default getAllUserFileKeysService;