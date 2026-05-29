import db from "../../db/db";
import { and, eq } from "drizzle-orm";
import { folderAccess } from "../../db/schema";

export async function hasAccessToFolderService(userId: string, folderId: string): Promise<string | null> {
  const [accessRecord] = await db
    .select({ access_id: folderAccess.accessId })
    .from(folderAccess)
    .where(and(eq(folderAccess.userId, userId), eq(folderAccess.folderId, folderId)))
    .limit(1);

  if (!accessRecord) {
    return null;
  }

  return accessRecord.access_id;
}
