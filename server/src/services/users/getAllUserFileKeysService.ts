import db from "../../db/db";
import { and, eq, or, sql } from 'drizzle-orm';
import { userAccess } from '../../db/schema';

import {GetFileKeysResult} from "../../types";
import { isUuidV4 } from "../../utils/validators";

async function getAllUserFileKeysService(user_id: string): Promise<Array<GetFileKeysResult>> {
    
    
    if (!isUuidV4(user_id)) {
        throw new Error("Invalid user ID");
    }

    // Legacy SQL: SELECT file_id, encrypted_file_key FROM user_access WHERE user_id = $1
    const result = await db.transaction(async (tx) => {
        await tx.delete(userAccess).where(
            and(
                eq(userAccess.userId, user_id),
                sql`${userAccess.shareDuration} <> 0`,
                sql`${userAccess.createdAt} + (${userAccess.shareDuration} * INTERVAL '1 day') < CURRENT_TIMESTAMP`
            )
        );

        return tx
            .select({
                file_id: userAccess.fileId,
                encrypted_file_key: userAccess.encryptedFileKey,
            })
            .from(userAccess)
            .where(
                and(
                    eq(userAccess.userId, user_id),
                    or(
                        eq(userAccess.shareDuration, 0),
                        sql`${userAccess.createdAt} + (${userAccess.shareDuration} * INTERVAL '1 day') >= CURRENT_TIMESTAMP`
                    )
                )
            );
    });
    
    const res = result.map(item => ({
        file_id: item.file_id,
        encrypted_file_key: item.encrypted_file_key,
    }));

    return res;
}

export default getAllUserFileKeysService;