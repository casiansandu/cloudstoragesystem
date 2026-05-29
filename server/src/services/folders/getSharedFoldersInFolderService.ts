import db from "../../db/db";
import { eq } from "drizzle-orm";
import { folders } from "../../db/schema";
import { getFolderAccessForUserService } from "./getFolderAccessForUserService";

export async function getSharedFoldersInFolderService(
  userId: string,
  folderId: string
): Promise<{ id: string; encrypted_name_data: string; encrypted_key_data: string }[]> {
  
  const access = await getFolderAccessForUserService(userId, folderId);
  if (access.accessType !== "owner" && !access.permissions.can_download) {
    throw new Error("Access denied");
  }

  const rows = await db
    .select({
      id: folders.id,
      encrypted_name_data: folders.encryptedNameData,
      encrypted_key_data: folders.encryptedKeyDataParentFolder, 
    })
    .from(folders)
    .where(eq(folders.parentId, folderId));

  return rows.map((row) => ({
    id: row.id,
    encrypted_name_data: row.encrypted_name_data ?? "",
    encrypted_key_data: row.encrypted_key_data,
  }));
}