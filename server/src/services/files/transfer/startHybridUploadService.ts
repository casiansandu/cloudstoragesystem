import db from "../../../db/db";
import { getStoragePath } from "../../../utils/getStoragePath";
import fs from 'node:fs/promises';
import { files, userAccess, users } from '../../../db/schema';
import { and, eq, lte, sql } from "drizzle-orm";
import config from "../../../config/config";
const USER_MAX_SPACE = Number.parseInt(config.USER_MAX_SPACE); // 5.147 GB

async function startHybridUploadService(
    enc_name: string,
    userId: string,
    file_size: number,
    encrypted_file_key: string,
    share_duration: number,
    folder_id: string
): Promise<{ file_id: string, access_id: string }> {

    return db.transaction(async (t) => {
        const [updatedUser] = await t
        .update(users)
        .set({
            usedSpace: sql`${users.usedSpace} + ${file_size}`
        })
        .where(
            and(
                eq(users.id, userId),
                lte(sql`${users.usedSpace} + ${file_size}`, USER_MAX_SPACE)
            )
    )
    .returning({ id: users.id });

        if (!updatedUser) {
            throw new Error("GLOBAL_QUOTA_EXCEEDED");
        }

        const [newFile] = await t
            .insert(files)
            .values({
                encryptedNameData: enc_name,
                ownerId: userId,
                fileSize: file_size,
                folderId: folder_id,
            })
            .returning({ id: files.id });

        const [access_id] = await t
            .insert(userAccess)
            .values({
                encryptedFileKey: encrypted_file_key,
                fileId: newFile.id,
                userId,
                shareDuration: share_duration,
                signature: "",
            })
            .returning({ access_id: userAccess.accessId });

        const storagePath = getStoragePath(newFile.id);
        await fs.mkdir(storagePath, { recursive: true });

        return { file_id: newFile.id, access_id: access_id.access_id };
    });
}

export default startHybridUploadService;