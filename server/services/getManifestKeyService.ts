import db from '../db/db';
export default async function getManifestKeyService(
    userId: string,
    fileId: string): Promise<string> {

    const result = await db.oneOrNone(
        `SELECT encrypted_manifest_key 
         FROM user_access 
         WHERE user_id = $1 AND file_id = $2`,
        [userId, fileId]
    );
    if (!result) {
        throw new Error('Manifest key not found for the given user and file');
    }
    return result.encrypted_manifest_key;
}