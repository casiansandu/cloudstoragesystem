import db from "../db/db";
import { getIdByUsername } from "./getIdByUsername";

export async function shareFileHybridService(
  file_id: string,
  recipient_username: string,
  encrypted_file_key: string,
  share_period: number,
  mlkem_ciphertext: string,
  x25519_ephemeral_public: string
): Promise<string> {
  let result: { id: string };

  const file_exists = await db.oneOrNone(`SELECT * FROM files WHERE id = $1`, [
    file_id,
  ]);

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

  const temp = await db.oneOrNone(
    `SELECT * FROM user_access WHERE file_id = $1 AND user_id = $2`,
    [file_id, recipient_id]
  );

  if (temp) {
    throw new Error("File already shared with this user");
  }
  
  result = await db.one(
      `INSERT INTO user_access (encrypted_file_key, file_id, user_id, share_duration, mlkem_ciphertext, x25519_ephemeral_public)
                VALUES ($1, $2, $3, $4, $5, $6)
                RETURNING access_id`,
        [encrypted_file_key, file_id, recipient_id, share_period, mlkem_ciphertext, x25519_ephemeral_public]
  );
  

  return result.id;
}
