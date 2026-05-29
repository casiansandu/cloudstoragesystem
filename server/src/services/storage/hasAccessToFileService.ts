import db from '../../db/db';
import { and, eq } from 'drizzle-orm';
import { userAccess } from '../../db/schema';

async function hasAccessToFileService(user_id: string, file_id: string): Promise<string> {
    // Legacy SQL: SELECT * FROM user_access WHERE user_id = $1 AND file_id = $2
    const [access_record] = await db
        .select({ access_id: userAccess.accessId })
        .from(userAccess)
        .where(and(eq(userAccess.userId, user_id), eq(userAccess.fileId, file_id)))
        .limit(1);
    
    if (!access_record) {
        return "";
    } else {
        return access_record.access_id;
    }
}

export default hasAccessToFileService;

