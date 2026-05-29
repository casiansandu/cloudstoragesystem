import db from "../../db/db";
import { eq } from "drizzle-orm";
import { files } from "../../db/schema";
import { isUuidV4 } from "../../utils/validators";

export type FileContext = {
  owner_id: string;
  folder_id: string | null;
};

export async function getFileContextService(fileId: string): Promise<FileContext> {
  if (!isUuidV4(fileId)) {
    throw new Error("Invalid file ID");
  }

  const [file] = await db
    .select({ owner_id: files.ownerId, folder_id: files.folderId })
    .from(files)
    .where(eq(files.id, fileId))
    .limit(1);

  if (!file) {
    throw new Error("File not found");
  }

  return {
    owner_id: file.owner_id,
    folder_id: file.folder_id ?? null,
  };
}
