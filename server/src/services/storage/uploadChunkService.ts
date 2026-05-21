import fs from 'node:fs/promises';
import { getStoragePath } from "../../utils/getStoragePath";
import { isUuidV4 } from '../../utils/validators';

async function uploadChunkService(bytes: Uint8Array<ArrayBufferLike>, file_id: string, chunk_id: string): Promise<number> {
    
    if (!isUuidV4(chunk_id)) {
        throw new Error("Invalid chunk ID");
    }
    if (!isUuidV4(file_id)) {
        throw new Error("Invalid file ID");
    }

    const storagePath = getStoragePath(file_id);

    await fs.writeFile(`${storagePath}/${chunk_id}`, Buffer.from(bytes));
        
    return bytes.byteLength;
}

export default uploadChunkService;