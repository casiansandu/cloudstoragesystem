import db from "../../db/db";
import { sql } from "drizzle-orm";
import { folders } from "../../db/schema";
import { isUuidV4 } from "../../utils/validators";

export type FolderAccessPermissions = {
  can_download: boolean;
  can_share: boolean;
  can_delete: boolean;
  can_upload: boolean;
};

export type FolderAccessInfo =
  | { accessType: "owner" }
  | {
  accessType: "shared" | "shared_subfolder";
      accessId: string;
      accessedByFolderId: string;
      encryptedFolderKey: string;
      mlkemCiphertext: string | null;
      x25519EphemeralPublic: string | null;
      permissions: FolderAccessPermissions;
    };

export async function getFolderAccessForUserService(
  userId: string,
  folderId: string
): Promise<FolderAccessInfo> {
  if (!isUuidV4(userId)) {
    throw new Error("Invalid user ID");
  }
  if (!isUuidV4(folderId)) {
    throw new Error("Invalid folder ID");
  }

  const [folder] = await db
    .select({ id: folders.id, owner_id: folders.ownerId })
    .from(folders)
    .where(sql`${folders.id} = ${folderId}`)
    .limit(1);

  if (!folder) {
    throw new Error("Folder not found");
  }

  if (folder.owner_id === userId) {
    return { accessType: "owner" };
  }

  const result = await db.execute(sql`
    WITH RECURSIVE ancestors AS (
      SELECT id, parent_id, 0 AS depth
      FROM folders
      WHERE id = ${folderId}
      UNION ALL
      SELECT f.id, f.parent_id, a.depth + 1
      FROM folders f
      JOIN ancestors a ON f.id = a.parent_id
      WHERE a.parent_id IS NOT NULL
    )
    SELECT
      fa.access_id,
      fa.folder_id,
      fa.encrypted_folder_key,
      fa.mlkem_ciphertext,
      fa.x25519_ephemeral_public,
      fa.can_download,
      fa.can_share,
      fa.can_delete,
      fa.can_upload
    FROM ancestors a
    JOIN folder_access fa ON fa.folder_id = a.id AND fa.user_id = ${userId}
    WHERE (
      fa.share_duration = 0 OR
      fa.created_at + (fa.share_duration * INTERVAL '1 day') >= CURRENT_TIMESTAMP
    )
    ORDER BY a.depth ASC
    LIMIT 1
  `);

  const access = (result as { rows: any[] }).rows?.[0];
  if (!access) {
    throw new Error("Access denied");
  }

  return {
    accessType: access.folder_id === folderId ? "shared" : "shared_subfolder",
    accessId: access.access_id,
    accessedByFolderId: access.folder_id,
    encryptedFolderKey: access.encrypted_folder_key,
    mlkemCiphertext: access.mlkem_ciphertext ?? null,
    x25519EphemeralPublic: access.x25519_ephemeral_public ?? null,
    permissions: {
      can_download: Boolean(access.can_download),
      can_share: Boolean(access.can_share),
      can_delete: Boolean(access.can_delete),
      can_upload: Boolean(access.can_upload),
    },
  };
}
