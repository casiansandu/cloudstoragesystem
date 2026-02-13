import db from "../db/db";
import { getStoragePath } from "../utils/getStoragePath";
import fs from 'fs/promises';

async function startHybridUploadService(
    enc_name: string,
    userId: string,
    path: string,
    file_size: number,
    encrypted_file_key: string,
    share_duration: number,
    folder_id: string
): Promise<{ file_id: string, access_id: string }> {
    
    return db.tx(async (t) => {
        
        const file_id = await t.one(
            'INSERT INTO files (encrypted_name_data, owner_id, path, file_size, folder_id) VALUES ($1, $2, $3, $4, $5) RETURNING id',
            [enc_name, userId, path, file_size, folder_id]
        );

        const access_id = await t.one(
            'INSERT INTO user_access (encrypted_file_key, file_id, user_id, share_duration) VALUES ($1, $2, $3, $4) RETURNING access_id',
            [encrypted_file_key, file_id.id, userId, share_duration]
        );

        const storagePath = getStoragePath(file_id.id);

        await fs.mkdir(storagePath, { recursive: true });

        return { file_id: file_id.id, access_id: access_id.access_id };
    });
}

export default startHybridUploadService;