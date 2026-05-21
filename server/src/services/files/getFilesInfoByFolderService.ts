import db from '../../db/db';
import { and, eq, isNull, or, sql } from 'drizzle-orm';
import { files, userAccess } from '../../db/schema';

export default async function getFilesInfoByFolderService(user_id: string, folder_id: string): Promise<{ id: string, encrypted_name_data: string, encrypted_key_data: string }[]> {

    // Legacy SQL: SELECT f.id, f.encrypted_name_data, ua.encrypted_file_key AS encrypted_key_data FROM files f JOIN user_access ua ON f.id = ua.file_id WHERE f.folder_id = $1 AND ua.user_id = $2 and ua.mlkem_ciphertext IS NULL
    const result = await db
        .select({
            id: files.id,
            encrypted_name_data: files.encryptedNameData,
            encrypted_key_data: userAccess.encryptedFileKey,
        })
        .from(files)
        .innerJoin(userAccess, eq(files.id, userAccess.fileId))
        .where(
            and(
                eq(files.folderId, folder_id),
                eq(userAccess.userId, user_id),
                isNull(userAccess.mlkemCiphertext),
                or(
                    eq(userAccess.shareDuration, 0),
                    sql`${userAccess.createdAt} + (${userAccess.shareDuration} * INTERVAL '1 day') >= CURRENT_TIMESTAMP`
                )
            )
        );

    return result;
}
