import db from '../../db/db';
import { sql, inArray } from 'drizzle-orm';
import { folders, files, folderAccess, userAccess } from '../../db/schema';

export async function deleteFolderService(folderId: string): Promise<void> {
  await db.transaction(async (tx) => {
    const [targetFolder] = await tx
      .select({ id: folders.id, parentId: folders.parentId })
      .from(folders)
      .where(sql`${folders.id} = ${folderId}`)
      .limit(1);

    if (!targetFolder) {
      throw new Error('Folder not found');
    }

    if (targetFolder.parentId === null) {
      throw new Error('Root folder cannot be deleted');
    }

    const descendantsResult = await tx.execute(sql`
      WITH RECURSIVE folder_tree AS (
        SELECT id FROM folders WHERE id = ${folderId}
        UNION ALL
        SELECT f.id FROM folders f
        INNER JOIN folder_tree ft ON f.parent_id = ft.id
      )
      SELECT id FROM folder_tree
    `);

    const folderIdsToDelete = (descendantsResult as { rows: any[] }).rows.map(r => r.id as string);

    if (folderIdsToDelete.length === 0) return;

    const filesResult = await tx.execute(sql`
      SELECT id FROM files WHERE folder_id = ANY(ARRAY[${sql.join(folderIdsToDelete, sql`, `)}]::uuid[])
    `);
    
    const fileIdsToDelete = (filesResult as { rows: any[] }).rows.map(r => r.id as string);

    if (fileIdsToDelete.length > 0) {
      await tx.delete(userAccess).where(inArray(userAccess.fileId, fileIdsToDelete));
      
      await tx.delete(files).where(inArray(files.id, fileIdsToDelete));
    }

    await tx.delete(folderAccess).where(inArray(folderAccess.folderId, folderIdsToDelete));
    
    await tx.delete(folders).where(inArray(folders.id, folderIdsToDelete));
  });
}