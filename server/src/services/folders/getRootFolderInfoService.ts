import db from '../../db/db';
import { and, eq, isNull } from 'drizzle-orm';
import { folders } from '../../db/schema';


export async function getRootFolderIdService(user_id: string): Promise<string> {
    // Legacy SQL: SELECT id FROM folders WHERE owner_id = $1 AND parent_id IS NULL
    const [result] = await db
        .select({ id: folders.id })
        .from(folders)
        .where(and(eq(folders.ownerId, user_id), isNull(folders.parentId)))
        .limit(1);

    if (!result) {
        throw new Error('Root folder id not found for the specified user.');
    }

    return result.id;
}