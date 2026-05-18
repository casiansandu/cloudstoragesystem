import db from "../../db/db";
import { and, eq, ne, or, sql } from "drizzle-orm";
import { files, userAccess } from "../../db/schema";

async function getSharedUserFilesService(
    userId: string
): Promise<Array<{ id: string; encrypted_name_data: string; encrypted_file_key: string }>> {
    if (!userId) {
        throw new Error("User not found");
    }

    try {
        return await db.transaction(async (tx) => {
            await tx.delete(userAccess).where(
                and(
                    eq(userAccess.userId, userId),
                    sql`${userAccess.shareDuration} <> 0`,
                    sql`${userAccess.createdAt} + (${userAccess.shareDuration} * INTERVAL '1 day') < CURRENT_TIMESTAMP`
                )
            );

            const rows = await tx
                .select({
                    id: files.id,
                    owner_id: files.ownerId,
                    encrypted_name_data: files.encryptedNameData,
                    encrypted_file_key: userAccess.encryptedFileKey,
                })
                .from(files)
                .innerJoin(userAccess, eq(files.id, userAccess.fileId))
                .where(
                    and(
                        ne(userAccess.userId, files.ownerId),
                        eq(userAccess.userId, userId),
                        or(
                            eq(userAccess.shareDuration, 0),
                            sql`${userAccess.createdAt} + (${userAccess.shareDuration} * INTERVAL '1 day') >= CURRENT_TIMESTAMP`
                        )
                    )
                );
            
            const to_return_rows = rows.map((file) => ({
                id: file.id,
                owner_id: file.owner_id,
                encrypted_name_data: file.encrypted_name_data,
                encrypted_file_key: file.encrypted_file_key,
            }));

            return to_return_rows;
        });
    } catch (error) {
        throw new Error('Failed to retrieve shared user files');
    }
}

export default getSharedUserFilesService;
