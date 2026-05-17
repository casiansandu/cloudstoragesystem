import db from "../../db/db";
import { eq } from 'drizzle-orm';
import { users } from '../../db/schema';

import { GetEncryptedArkResult } from "../../types";

async function getEncryptedArkService(id: string): Promise<GetEncryptedArkResult> {

    // Legacy SQL: SELECT encrypted_ark FROM srp_users WHERE id = $1
    const [result] = await db
        .select({ encrypted_ark: users.encryptedArk })
        .from(users)
        .where(eq(users.id, id))
        .limit(1);

    if (!result) {
        throw new Error('Error fetching user keys: user with id not found');
    }

    return result;
}

export default getEncryptedArkService;