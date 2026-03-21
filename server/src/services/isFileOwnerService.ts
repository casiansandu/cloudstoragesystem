import db from '../db/db';

export default async function isFileOwnerService(user_id: string, file_id: string): Promise<boolean> {
  
    const file = await db.oneOrNone('SELECT * FROM files WHERE id = $1 AND owner_id = $2', [file_id, user_id]);

    return file !== null;
}