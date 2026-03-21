import db from "../db/db";


export default async function getFileMasterKeyService(user_id: string, file_id: string): Promise<string> {

    const enc_file_key = await db.oneOrNone(
        `SELECT encrypted_file_key FROM user_access 
         WHERE file_id = $1 AND user_id = $2`,
        [file_id, user_id]
    );
    if (!enc_file_key) {
        throw new Error('Error fetching file master key: access not found for this user and file');
    }
    
    return enc_file_key.encrypted_file_key;
}