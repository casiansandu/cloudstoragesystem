import db from '../../../db/db';
import { and, eq } from 'drizzle-orm';
import { userAccess } from '../../../db/schema';

export default async function getSharingUserIdFromAccessService(user_id: string, file_id: string): Promise<string> {
    const result = await db
        .select({ sharing_user_id: userAccess.sharing_user_id })
        .from(userAccess)
        .where(and(eq(userAccess.fileId, file_id), eq(userAccess.userId, user_id)));

    if (result.length === 0) {
        throw new Error('File not found');
    }

    if (!result[0].sharing_user_id) {
        throw new Error('Sharing user ID not found');
    }

    return result[0].sharing_user_id;
}