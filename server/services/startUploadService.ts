import db from "../db/db";

async function startUploadService(enc_name: string, userId: string, path: string, file_size: number): Promise<string> {
    
    const { id: file_id } = await db.one(
        'INSERT INTO files (enc_name, owner_id, path, file_size) VALUES ($1, $2, $3, $4) returning id',
        [enc_name, userId, path, file_size]
    );

    console.log(`Started upload for file ID: ${file_id}, path: ${path}, size: ${file_size}`);
    
    return file_id;

}

export default startUploadService;