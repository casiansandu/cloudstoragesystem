import db from '../../db/db';
import { and, eq, or, sql } from 'drizzle-orm';
import { userAccess } from '../../db/schema';
import { isUuidV4 } from '../../utils/validators';

async function hasAccessToFileService(user_id: string, file_id: string): Promise<string | null> {
    // Legacy SQL: SELECT * FROM user_access WHERE user_id = $1 AND file_id = $2

    
    if (!isUuidV4(file_id)) {
        throw new Error('Invalid file ID');
    }
    if (!isUuidV4(user_id)) {
        throw new Error('Invalid user ID');
    }
    const [access_record] = await db
        .select({ access_id: userAccess.accessId })
        .from(userAccess)
        .where(
            and(
                eq(userAccess.userId, user_id),
                eq(userAccess.fileId, file_id),
                or(
                    eq(userAccess.shareDuration, 0),
                    sql`${userAccess.createdAt} + (${userAccess.shareDuration} * INTERVAL '1 day') >= CURRENT_TIMESTAMP`
                )
            )
        )
        .limit(1);

    return access_record ? access_record.access_id : null;
}

export default hasAccessToFileService;

