import db from "../../db/db";
import { eq } from 'drizzle-orm';
import { users } from '../../db/schema';

import { GetPublicKeyResult } from "../../types";

async function getPublicKeyService(id: string): Promise<GetPublicKeyResult> {

    // Legacy SQL: SELECT user_rsa_public FROM srp_users WHERE id = $1
    const [result] = await db
        .select({ user_rsa_public: users.userRsaPublic })
        .from(users)
        .where(eq(users.id, id))
        .limit(1);

    if (!result) {
        throw new Error('Error fetching user keys: user with id not found');
    }

    return result;
}

export default getPublicKeyService;