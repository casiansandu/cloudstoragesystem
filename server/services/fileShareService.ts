import db from '../db/db';
import { getIdByUsername } from './getIdByUsername';

export async function shareFileService(
    file_id: string, 
    recipient_username: string, 
    encrypted_file_key: string,
    encrypted_manifest_key: string
): Promise<string> {

        const file_exists = await db.oneOrNone(
            `SELECT * FROM files WHERE id = $1`,
            [file_id]
        );

        if (!file_exists) {
            throw new Error('File does not exist');
        }
        
        const recipient_id = await getIdByUsername(recipient_username);
        if (!recipient_id) {
            throw new Error('Recipient does not exist');
        }

        const result = await db.one(
            `INSERT INTO user_access (encrypted_file_key, file_id, user_id, encrypted_manifest_key)
             VALUES ($1, $2, $3, $4)
             RETURNING access_id`,
            [encrypted_file_key, file_id, recipient_id, encrypted_manifest_key]
        );

        return result.id;
}