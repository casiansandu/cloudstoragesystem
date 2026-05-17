import db from "../../db/db";
import { getStoragePath } from "../../utils/getStoragePath";
import fs from 'node:fs/promises';
import { files, userAccess } from '../../db/schema';

async function startHybridUploadService(
    enc_name: string,
    userId: string,
    path: string,
    file_size: number,
    encrypted_file_key: string,
    share_duration: number,
    folder_id: string
): Promise<{ file_id: string, access_id: string }> {
    
    return db.transaction(async (t) => {
        // Legacy SQL: INSERT INTO files (...) VALUES (...) RETURNING id
        const [newFile] = await t
            .insert(files)
            .values({
                encryptedNameData: enc_name,
                ownerId: userId,
                path,
                fileSize: file_size,
                folderId: folder_id,
            })
            .returning({ id: files.id });

        // Legacy SQL: INSERT INTO user_access (...) VALUES (...) RETURNING access_id
        const [access_id] = await t
            .insert(userAccess)
            .values({
                encryptedFileKey: encrypted_file_key,
                fileId: newFile.id,
                userId,
                shareDuration: share_duration,
            })
            .returning({ access_id: userAccess.accessId });

        const storagePath = getStoragePath(newFile.id);

        await fs.mkdir(storagePath, { recursive: true });

        return { file_id: newFile.id, access_id: access_id.access_id };
    });
}

export default startHybridUploadService;