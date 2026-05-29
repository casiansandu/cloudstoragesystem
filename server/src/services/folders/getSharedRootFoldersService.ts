import db from "../../db/db";
import { and, eq, isNull, or, sql } from "drizzle-orm";
import { folderAccess, folderPermissions, folders } from "../../db/schema";

export async function getSharedRootFoldersService(userId: string): Promise<{ id: string; encrypted_name_data: string; encrypted_access_key_data: string }[]> {
  if (!userId) {
    throw new Error("User not found");
  }

  const rows = await db
    .select({
      id: folders.id,
      encrypted_name_data: folders.encryptedNameData,
      encrypted_access_key_data: folderAccess.encryptedFolderKey,
    })
    .from(folderAccess)
    .innerJoin(folders, eq(folderAccess.folderId, folders.id))
    .innerJoin(folderPermissions, and(eq(folderPermissions.accessId, folderAccess.accessId), eq(folderPermissions.userId, folderAccess.userId)))
    .where(
      and(
        eq(folderAccess.userId, userId),
        isNull(folders.parentId),
        eq(folderPermissions.canDownload, true),
        or(
          eq(folderAccess.shareDuration, 0),
          sql`${folderAccess.createdAt} + (${folderAccess.shareDuration} * INTERVAL '1 day') >= CURRENT_TIMESTAMP`
        )
      )
    );

  return rows.map((row) => ({
    id: row.id,
    encrypted_name_data: row.encrypted_name_data ?? "",
    encrypted_access_key_data: row.encrypted_access_key_data,
  }));
}
