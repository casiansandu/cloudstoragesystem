import fs from 'node:fs/promises';
import { getStoragePath } from "../../utils/getStoragePath";

async function uploadChunkService(bytes: Uint8Array<ArrayBufferLike>, file_id: string, chunk_id: string): Promise<number> {

    const storagePath = getStoragePath(file_id);

    await fs.writeFile(`${storagePath}/${chunk_id}`, Buffer.from(bytes));
        
    return bytes.byteLength;
}

export default uploadChunkService;