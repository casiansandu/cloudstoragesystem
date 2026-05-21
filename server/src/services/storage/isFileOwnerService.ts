import db from '../../db/db';
import { and, eq } from 'drizzle-orm';
import { files } from '../../db/schema';
import { isUuidV4 } from '../../utils/validators';

export default async function isFileOwnerService(user_id: string, file_id: string): Promise<boolean> {
  
    if (!isUuidV4(file_id)) {
        throw new Error('Invalid file ID');
    }
    if (!isUuidV4(user_id)) {
        throw new Error('Invalid user ID');
    }
    // Legacy SQL: SELECT * FROM files WHERE id = $1 AND owner_id = $2
    const file = await db
        .select({ id: files.id })
        .from(files)
        .where(and(eq(files.id, file_id), eq(files.ownerId, user_id)))
        .limit(1);

    return file.length > 0;
}