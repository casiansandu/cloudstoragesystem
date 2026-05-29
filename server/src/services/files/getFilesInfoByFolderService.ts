import db from '../../db/db';
import { and, eq, isNull } from 'drizzle-orm';
import { files, userAccess } from '../../db/schema';

export default async function getFilesInfoByFolderService(user_id: string, folder_id: string): Promise<{ id: string, encrypted_name_data: string, encrypted_key_data: string }[]> {

    
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
                isNull(userAccess.mlkemCiphertext)
            )
        );

    const uniqueFiles = new Map();
    for (const row of result) {
        if (!uniqueFiles.has(row.id)) {
            uniqueFiles.set(row.id, {
                id: row.id,
                encrypted_name_data: row.encrypted_name_data ?? '',
                encrypted_key_data: row.encrypted_key_data,
            });
        }
    }

    return Array.from(uniqueFiles.values());
}