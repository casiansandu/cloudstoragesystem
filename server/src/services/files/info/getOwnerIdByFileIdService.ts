import db from '../../../db/db';
import { and, eq, isNull } from 'drizzle-orm';
import { files, userAccess } from '../../../db/schema';

export default async function getOwnerIdByFileIdService(file_id: string): Promise<string> {
    const result = await db
        .select({ owner_id: files.ownerId })
        .from(files)
        .where(eq(files.id, file_id));

    if (result.length === 0) {
        throw new Error('File not found');
    }

    return result[0].owner_id;
}