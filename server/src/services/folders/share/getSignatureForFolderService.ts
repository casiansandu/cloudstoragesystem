import db from '../../../db/db';
import { and, eq } from 'drizzle-orm';
import { folderAccess } from '../../../db/schema';

export default async function getSignatureForFolderService(user_id: string, folder_id: string): Promise<string> {
    const result = await db
        .select({ signature: folderAccess.signature })
        .from(folderAccess)
        .where(and(eq(folderAccess.folderId, folder_id), eq(folderAccess.userId, user_id)));

    if (result.length === 0) {
        throw new Error('Folder not found');
    }

    if (!result[0].signature) {
        throw new Error('Signature not found');
    }

    return result[0].signature;
}