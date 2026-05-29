import db from "../../db/db";
import { and, eq, ne, or, sql } from "drizzle-orm";
import { folderAccess, folders } from "../../db/schema";

export type SharedFolder = {
  id: string;
  encrypted_name_data: string;
  encrypted_key_data: string;
};

export async function getSharedFoldersService(userId: string): Promise<SharedFolder[]> {
  if (!userId) {
    throw new Error("User not found");
  }

  try {
    return await db.transaction(async (tx) => {
      await tx.delete(folderAccess).where(
        and(
          eq(folderAccess.userId, userId),
          sql`${folderAccess.shareDuration} <> 0`,
          sql`${folderAccess.createdAt} + (${folderAccess.shareDuration} * INTERVAL '1 day') < CURRENT_TIMESTAMP`
        )
      );

      const rows = await tx
        .select({
          id: folders.id,
          owner_id: folders.ownerId,
          encrypted_name_data: folders.encryptedNameData,
          encrypted_key_data: folderAccess.encryptedFolderKey,
        })
        .from(folderAccess)
        .innerJoin(folders, eq(folderAccess.folderId, folders.id))
        .where(
          and(
            ne(folderAccess.userId, folders.ownerId),
            eq(folderAccess.userId, userId),
            or(
              eq(folderAccess.shareDuration, 0),
              sql`${folderAccess.createdAt} + (${folderAccess.shareDuration} * INTERVAL '1 day') >= CURRENT_TIMESTAMP`
            )
          )
        );

      return rows.map((row) => ({
        id: row.id,
        encrypted_name_data: row.encrypted_name_data ?? "",
        encrypted_key_data: row.encrypted_key_data,
      }));
    });
  } catch (error) {
    throw new Error("Failed to retrieve shared folders");
  }
}
