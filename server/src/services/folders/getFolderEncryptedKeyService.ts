import db from "../../db/db";
import { and, eq } from "drizzle-orm";
import { folderAccess, folders } from "../../db/schema";

export async function getFolderEncryptedKeyService(
  userId: string,
  folderId: string,
  access_type: string
): Promise<string> {
  if (access_type === "shared_subfolder") {
    const [result] = await db
      .select({ encrypted_key_data: folders.encryptedKeyDataParentFolder })
      .from(folders)
      .where(eq(folders.id, folderId))
      .limit(1);

    if (!result) {
      throw new Error("Parent folder key not found for the specified folder.");
    }

    return result.encrypted_key_data;
  } else if (access_type === "shared") {
    const [result] = await db
      .select({ encrypted_key_data: folderAccess.encryptedFolderKey })
      .from(folderAccess)
      .where(and(eq(folderAccess.folderId, folderId), eq(folderAccess.userId, userId)))
      .limit(1);

    if (!result) {
      throw new Error("Shared folder key not found for the specified folder and user.");
    }

    return result.encrypted_key_data;
  } else if (access_type === "owner") {
    const [result] = await db
      .select({ encrypted_key_data: folders.encryptedKeyDataArk })
      .from(folders)
      .where(and(eq(folders.id, folderId), eq(folders.ownerId, userId)))
      .limit(1);

    if (!result) {
      throw new Error("Folder key not found for the specified folder and user.");
    }
    return result.encrypted_key_data;
  }

  throw new Error("Invalid access type");

}
