import { FILESYSTEM_ROOT } from "../config/config";
import fs from 'fs/promises';

async function uploadChunkService(bytes: Uint8Array<ArrayBufferLike>, chunk_id: string): Promise<number> {
    
    console.log("bytes length: ", bytes.byteLength);

    const uuid_0_2 = `${chunk_id.slice(0,2)}`;

    await fs.mkdir(`${FILESYSTEM_ROOT}/${uuid_0_2}`, { recursive: true });

    await fs.writeFile(`${FILESYSTEM_ROOT}/${uuid_0_2}/${chunk_id}`, Buffer.from(bytes));

    console.log("Chunk saved successfully!");
        
    return bytes.byteLength;
}

export default uploadChunkService;