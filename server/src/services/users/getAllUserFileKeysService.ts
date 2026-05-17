import db from "../../db/db";
import { eq } from 'drizzle-orm';
import { userAccess } from '../../db/schema';

import {GetFileKeysResult} from "../../types";

async function getAllUserFileKeysService(user_id: string): Promise<Array<GetFileKeysResult>> {

    // Legacy SQL: SELECT file_id, encrypted_file_key FROM user_access WHERE user_id = $1
    const result = await db
        .select({
            file_id: userAccess.fileId,
            encrypted_file_key: userAccess.encryptedFileKey,
        })
        .from(userAccess)
        .where(eq(userAccess.userId, user_id));
    
    const res = result.map(item => ({
        file_id: item.file_id,
        encrypted_file_key: item.encrypted_file_key,
    }));

    return res;
}

export default getAllUserFileKeysService;