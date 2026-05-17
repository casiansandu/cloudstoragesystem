import db from "../../db/db";
import { eq } from 'drizzle-orm';
import { users } from '../../db/schema';

import { GetEncryptedSeedResult } from "../../types";

async function getEncryptedSeedService(id: string): Promise<GetEncryptedSeedResult> {

    // Legacy SQL: SELECT encrypted_seed FROM srp_users WHERE id = $1
    const [result] = await db
        .select({ encrypted_seed: users.encryptedSeed })
        .from(users)
        .where(eq(users.id, id))
        .limit(1);

    if (!result) {
        throw new Error('Error fetching user keys: user with id not found');
    }

    return result;
}

export default getEncryptedSeedService;