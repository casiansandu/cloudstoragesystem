import db from "../../db/db";
import { and, eq, sql } from "drizzle-orm";
import { files, userAccess } from "../../db/schema";
import { getFolderAccessForUserService } from "./getFolderAccessForUserService";

export async function getSharedFilesInFolderService(
  userId: string,
  folderId: string
): Promise<{ id: string; encrypted_name_data: string; encrypted_key_data: string }[]> {
  const access = await getFolderAccessForUserService(userId, folderId);
  if (access.accessType !== "owner" && !access.permissions.can_download) {
    throw new Error("Access denied");
  }

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
        encrypted_name_data: files.encryptedNameData,
        encrypted_key_data: userAccess.encryptedFileKey,
      })
      .from(files)
      .innerJoin(
        userAccess,
        and(eq(files.id, userAccess.fileId), eq(userAccess.userId, files.ownerId))
      )
      .where(eq(files.folderId, folderId));

    return rows.map((row) => ({
      id: row.id,
      encrypted_name_data: row.encrypted_name_data ?? "",
      encrypted_key_data: row.encrypted_key_data,
    }));
  });
}
