import db from "../../db/db";
import { getIdByUsername } from "../users/getIdByUsername";
import { and, eq } from 'drizzle-orm';
import { files, userAccess } from '../../db/schema';
import { isUuidV4 } from "../../utils/validators";

export async function shareFileHybridService(
  requester_id: string,
  file_id: string,
  recipient_username: string,
  encrypted_file_key: string,
  share_period: number,
  mlkem_ciphertext: string,
  x25519_ephemeral_public: string
): Promise<string> {

  if (!isUuidV4(file_id)) {
    throw new Error("Invalid file ID");
  }
  if (!isUuidV4(requester_id)) {
    throw new Error("Invalid requester ID");
  }

  let result: { id: string };

  const [file_exists] = await db
    .select({ id: files.id, owner_id: files.ownerId })
    .from(files)
    .where(eq(files.id, file_id))
    .limit(1);

  if (!file_exists) {
    throw new Error("File does not exist");
  }

  if (file_exists.owner_id !== requester_id) {
    throw new Error("Access denied: not file owner");
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
  
  // Legacy SQL: INSERT INTO user_access (...) VALUES (...) RETURNING access_id
  const [insertedAccess] = await db
    .insert(userAccess)
    .values({
      encryptedFileKey: encrypted_file_key,
      fileId: file_id,
      userId: recipient_id,
      shareDuration: share_period,
      mlkemCiphertext: mlkem_ciphertext,
      x25519EphemeralPublic: x25519_ephemeral_public,
    })
    .returning({ id: userAccess.accessId });
  result = { id: insertedAccess.id };
  

  return result.id;
}
