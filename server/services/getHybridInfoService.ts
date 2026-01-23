import db from "../db/db";
import { HybridInfoResult } from "../types";


export async function getHybridInfoService(fileId: string, userId: string): Promise<HybridInfoResult> {
    const info: { x25519_ephemeral_public: string; mlkem_ciphertext: string } | null = await db.oneOrNone(
        `SELECT x25519_ephemeral_public, mlkem_ciphertext 
         FROM user_access 
         WHERE file_id = $1 AND user_id = $2`,
        [fileId, userId]
    );

    if (!info) {
        throw new Error('Access record not found for the given file and user');
    }
    return {
        x25519_ephemeral_public: info.x25519_ephemeral_public,
        mlkem_ciphertext: info.mlkem_ciphertext
    };
}