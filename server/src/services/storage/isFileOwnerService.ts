import db from '../../db/db';
import { and, eq } from 'drizzle-orm';
import { files } from '../../db/schema';

export default async function isFileOwnerService(user_id: string, file_id: string): Promise<boolean> {
  
    // Legacy SQL: SELECT * FROM files WHERE id = $1 AND owner_id = $2
    const file = await db
        .select({ id: files.id })
        .from(files)
        .where(and(eq(files.id, file_id), eq(files.ownerId, user_id)))
        .limit(1);

    return file.length > 0;
}