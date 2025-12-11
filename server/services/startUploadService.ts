import db from "../db/db";

async function startUploadService(userId: string, path: string, file_size: number): Promise<string> {
    
    const { id: file_id } = await db.one(
        'INSERT INTO files (owner_id, path, file_size) VALUES ($1, $2, $3) returning id',
        [userId, path, file_size]
    );

    console.log(`Started upload for file ID: ${file_id}, path: ${path}, size: ${file_size}`);
    
    return file_id;

}

export default startUploadService;