import db from "../../db/db";
import { and, eq } from 'drizzle-orm';
import { userAccess } from '../../db/schema';


export default async function getFileMasterKeyService(user_id: string, file_id: string): Promise<string> {

    // Legacy SQL: SELECT encrypted_file_key FROM user_access WHERE file_id = $1 AND user_id = $2
    const [enc_file_key] = await db
        .select({ encrypted_file_key: userAccess.encryptedFileKey })
        .from(userAccess)
        .where(and(eq(userAccess.fileId, file_id), eq(userAccess.userId, user_id)))
        .limit(1);
    if (!enc_file_key) {
        throw new Error('Error fetching file master key: access not found for this user and file');
    }
    
    return enc_file_key.encrypted_file_key;
}