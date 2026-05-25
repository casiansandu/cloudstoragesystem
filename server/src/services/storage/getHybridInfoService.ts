import db from "../../db/db";
import { HybridInfoResult } from "../../types";
import { and, eq } from 'drizzle-orm';
import { userAccess } from '../../db/schema';


export async function getHybridInfoService(fileId: string, userId: string): Promise<HybridInfoResult> {
    // Legacy SQL: SELECT x25519_ephemeral_public, mlkem_ciphertext FROM user_access WHERE file_id = $1 AND user_id = $2
    const [info] = await db
        .select({
            x25519_ephemeral_public: userAccess.x25519EphemeralPublic,
            mlkem_ciphertext: userAccess.mlkemCiphertext,
        })
        .from(userAccess)
        .where(and(eq(userAccess.fileId, fileId), eq(userAccess.userId, userId)))
        .limit(1);

    if (!info) {
        throw new Error('Access record not found for the given file and user');
    }
    
    if (!info.x25519_ephemeral_public || !info.mlkem_ciphertext) {
        throw new Error('Hybrid encryption fields are missing for the given file and user');
    }
    return {
        x25519_ephemeral_public: info.x25519_ephemeral_public,
        mlkem_ciphertext: info.mlkem_ciphertext
    };
}