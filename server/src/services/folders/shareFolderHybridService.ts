import db from "../../db/db";
import { and, eq } from "drizzle-orm";
import { folderAccess, folders } from "../../db/schema";
import { getIdByUsername } from "../users/getIdByUsername";
import { isUuidV4 } from "../../utils/validators";

export async function shareFolderHybridService(
  requester_id: string,
  folder_id: string,
  recipient_id: string,
  encrypted_folder_key: string,
  share_period: number,
  mlkem_ciphertext: string,
  x25519_ephemeral_public: string,
  permissions: { can_download: boolean; can_share: boolean; can_delete: boolean; can_upload: boolean }
): Promise<string> {
  if (!isUuidV4(folder_id)) {
    throw new Error("Invalid folder ID");
  }
  if (!isUuidV4(requester_id)) {
    throw new Error("Invalid requester ID");
  }
  if (!isUuidV4(recipient_id)) {
    throw new Error("Invalid recipient ID");
  }

  const [folder_exists] = await db
    .select({ id: folders.id, owner_id: folders.ownerId })
    .from(folders)
    .where(eq(folders.id, folder_id))
    .limit(1);

  if (!folder_exists) {
    throw new Error("Folder does not exist");
  }

  if (recipient_id === requester_id) {
    throw new Error("Cannot share folder with yourself");
  }

  const [existing] = await db
    .select({ access_id: folderAccess.accessId })
    .from(folderAccess)
    .where(and(eq(folderAccess.folderId, folder_id), eq(folderAccess.userId, recipient_id)))
    .limit(1);

  if (existing) {
    throw new Error("Folder already shared with this user");
  }

  const [insertedAccess] = await db
    .insert(folderAccess)
    .values({
      encryptedFolderKey: encrypted_folder_key,
      folderId: folder_id,
      userId: recipient_id,
      shareDuration: share_period,
      mlkemCiphertext: mlkem_ciphertext,
      x25519EphemeralPublic: x25519_ephemeral_public,
      canDownload: permissions.can_download,
      canShare: permissions.can_share,
      canDelete: permissions.can_delete,
      canUpload: permissions.can_upload,
    })
    .returning({ id: folderAccess.accessId });


  return insertedAccess.id;
}
