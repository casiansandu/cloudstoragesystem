import db from '../db/db';

async function hasAccessToFileService(user_id: string, file_id: string): Promise<string> {
    const access_record = await db.oneOrNone(
        `SELECT * FROM user_access 
         WHERE user_id = $1 AND file_id = $2`,
        [user_id, file_id]
    );
    return access_record.access_id;
}

export default hasAccessToFileService;

