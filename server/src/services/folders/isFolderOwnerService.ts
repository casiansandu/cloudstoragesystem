import db from '../../db/db';
import { and, eq } from 'drizzle-orm';
import { folders } from '../../db/schema';

export default async function isFolderOwnerService(user_id: string, folder_id: string): Promise<boolean> {
	// Legacy SQL: SELECT * FROM folders WHERE id = $1 AND owner_id = $2
	const folder = await db
		.select({ id: folders.id })
		.from(folders)
		.where(and(eq(folders.id, folder_id), eq(folders.ownerId, user_id)))
		.limit(1);

	return folder.length == 1;
}
