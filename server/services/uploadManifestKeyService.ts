import db from '../db/db';

async function uploadManifestKeyService(
    user_id: string,
    file_id: string,
    encrypted_master_key: string
): Promise<string> {
    const result = await db.one(
        `INSERT INTO user_access (encrypted_manifest_key)
         VALUES ($1)
         WHERE file_id = $2 AND user_id = $3
         RETURNING access_id`,
        [encrypted_master_key, file_id, user_id]
    );

    return result.access_id;
}