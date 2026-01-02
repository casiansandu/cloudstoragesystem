import db from "../db/db";
import { getStoragePath } from "../utils/getStoragePath";
import fs from 'fs/promises';

async function startUploadService(
    enc_name: string,
    userId: string,
    path: string,
    file_size: number,
    encrypted_file_key: string,
    wrapped_manifest_key: string
): Promise<{ file_id: string, access_id: string }> {
    
    return db.tx(async (t) => {
        
        const file_id = await t.one(
            'INSERT INTO files (enc_name, owner_id, path, file_size) VALUES ($1, $2, $3, $4) RETURNING id',
            [enc_name, userId, path, file_size]
        );

        const access_id = await t.one(
            'INSERT INTO user_access (encrypted_file_key, file_id, user_id, encrypted_manifest_key) VALUES ($1, $2, $3, $4) RETURNING access_id',
            [encrypted_file_key, file_id.id, userId, wrapped_manifest_key]
        );

        const storagePath = getStoragePath(file_id.id);
        //console.log("Creating storage path at ", storagePath);

        await fs.mkdir(storagePath, { recursive: true });

        return { file_id: file_id.id, access_id: access_id.access_id };
    });
}

export default startUploadService;