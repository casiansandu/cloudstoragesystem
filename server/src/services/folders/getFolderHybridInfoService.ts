import db from "../../db/db";
import { and, eq, or, sql } from "drizzle-orm";
import { folderAccess } from "../../db/schema";
import { isUuidV4 } from "../../utils/validators";

export async function getFolderHybridInfoService(
  folderId: string,
  userId: string
): Promise<{ x25519_ephemeral_public: string; mlkem_ciphertext: string }> {
  if (!isUuidV4(folderId)) {
    throw new Error("Invalid folder ID");
  }
  if (!isUuidV4(userId)) {
    throw new Error("Invalid user ID");
  }

  const [info] = await db
    .select({
      x25519_ephemeral_public: folderAccess.x25519EphemeralPublic,
      mlkem_ciphertext: folderAccess.mlkemCiphertext,
    })
    .from(folderAccess)
    .where(
      and(
        eq(folderAccess.folderId, folderId),
        eq(folderAccess.userId, userId),
        or(
          eq(folderAccess.shareDuration, 0),
          sql`${folderAccess.createdAt} + (${folderAccess.shareDuration} * INTERVAL '1 day') >= CURRENT_TIMESTAMP`
        )
      )
    )
    .limit(1);

  if (!info) {
    throw new Error("Access record not found for the given folder and user");
  }

  if (!info.x25519_ephemeral_public || !info.mlkem_ciphertext) {
    throw new Error("Hybrid encryption fields are missing for the given folder and user");
  }

  return {
    x25519_ephemeral_public: info.x25519_ephemeral_public,
    mlkem_ciphertext: info.mlkem_ciphertext,
  };
}
