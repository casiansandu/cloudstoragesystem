import db from "../../../db/db";
import { getIdByUsername } from "../../users/info/getIdByUsername";
import { and, eq } from 'drizzle-orm';
import { files, userAccess } from '../../../db/schema';

export async function shareFileHybridService(
  sharing_user_id: string,
  file_id: string,
  recipient_username: string,
  encrypted_file_key: string,
  share_period: number,
  mlkem_ciphertext: string,
  x25519_ephemeral_public: string,
  signature: string
): Promise<string> {
  let result: { id: string };

  const [file_exists] = await db
    .select({ id: files.id, owner_id: files.ownerId })
    .from(files)
    .where(eq(files.id, file_id))
    .limit(1);

  if (!file_exists) {
    throw new Error("File does not exist");
  }

  const recipient_id = await getIdByUsername(recipient_username);
  if (!recipient_id) {
    throw new Error("Recipient does not exist");
  }

  if (recipient_id === file_exists.owner_id) {
    throw new Error("Cannot share file with yourself");
  }

  const [temp] = await db
    .select({ access_id: userAccess.accessId })
    .from(userAccess)
    .where(and(eq(userAccess.fileId, file_id), eq(userAccess.userId, recipient_id)))
    .limit(1);

  if (temp) {
    throw new Error("File already shared with this user");
  }
  
  const [insertedAccess] = await db
    .insert(userAccess)
    .values({
      sharing_user_id: sharing_user_id,
      encryptedFileKey: encrypted_file_key,
      fileId: file_id,
      userId: recipient_id,
      shareDuration: share_period,
      mlkemCiphertext: mlkem_ciphertext,
      x25519EphemeralPublic: x25519_ephemeral_public,
      signature: signature,
    })
    .returning({ id: userAccess.accessId });
  result = { id: insertedAccess.id };
  

  return result.id;
}


