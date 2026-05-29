import db from "../../db/db";
import { eq } from "drizzle-orm";
import { folders } from "../../db/schema";
import { getFolderAccessForUserService } from "./getFolderAccessForUserService";

export async function getSharedFolderParentIdAndNameService(
  userId: string,
  folderId: string
): Promise<{ parent_id: string | null; encrypted_parent_name_data: string | null }> {
  const access = await getFolderAccessForUserService(userId, folderId);
  if (access.accessType === "owner") {
    throw new Error("Folder is not shared with the user");
  }

  const [folder] = await db
    .select({ parent_id: folders.parentId })
    .from(folders)
    .where(eq(folders.id, folderId))
    .limit(1);

  if (!folder) {
    throw new Error("Folder not found");
  }

  if (!folder.parent_id) {
    return { parent_id: null, encrypted_parent_name_data: null };
  }

  const [parent] = await db
    .select({ encrypted_parent_name_data: folders.encryptedNameData })
    .from(folders)
    .where(eq(folders.id, folder.parent_id))
    .limit(1);

  if (!parent) {
    throw new Error("Parent folder not found");
  }

  return {
    parent_id: folder.parent_id,
    encrypted_parent_name_data: parent.encrypted_parent_name_data ?? "",
  };
}
