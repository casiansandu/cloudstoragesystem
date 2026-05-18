import db from "../../db/db";
import { and, eq, sql } from 'drizzle-orm';
import { files, userAccess } from '../../db/schema';


async function getAllUserFilesService(owner_id: string): Promise<Array<{id: string, encrypted_name_data: string}>> {

    if (!owner_id) {
        throw new Error('User not found');
    }

    // Legacy SQL: SELECT f.id, f.enc_name FROM files f JOIN user_access ua ON f.id = ua.file_id WHERE ua.user_id = $1 AND (ua.share_duration = 0 OR ua.created_at + (ua.share_duration * INTERVAL '1 day') >= CURRENT_TIMESTAMP)
    // Legacy SQL: DELETE FROM user_access WHERE user_id = $1 AND share_duration != 0 AND created_at + (share_duration * INTERVAL '1 day') < CURRENT_TIMESTAMP returning file_id

    try {
        return await db.transaction(async tx => {
            await tx.delete(userAccess).where(
                and(
                    eq(userAccess.userId, owner_id),
                    sql`${userAccess.shareDuration} <> 0`,
                    sql`${userAccess.createdAt} + (${userAccess.shareDuration} * INTERVAL '1 day') < CURRENT_TIMESTAMP`
                )
            );

            const rows = await tx
                .select({
                    id: files.id,
                    encrypted_name_data: files.encryptedNameData,
                })
                .from(files)
                .innerJoin(userAccess, eq(files.id, userAccess.fileId))
                .where(
                    and(
                        eq(userAccess.userId, owner_id),
                        sql`${userAccess.shareDuration} = 0 OR ${userAccess.createdAt} + (${userAccess.shareDuration} * INTERVAL '1 day') >= CURRENT_TIMESTAMP`
                    )
                );

            return rows.map(file => ({ id: file.id, encrypted_name_data: file.encrypted_name_data }));
        });
    }
    catch (error) {
        throw new Error('Failed to retrieve user files');
    }
    
}

export default getAllUserFilesService;