import db from "../../db/db";
import { eq } from 'drizzle-orm';
import { users } from '../../db/schema';

import { GetKeysResult } from "../../types";

async function getUserKeysService(id: string): Promise<GetKeysResult> {

    // Legacy SQL: SELECT kdf_salt, user_rsa_public, encrypted_user_rsa_private FROM srp_users WHERE id = $1
    const [result] = await db
        .select({
            kdf_salt: users.kdfSalt,
            user_rsa_public: users.userRsaPublic,
            encrypted_user_rsa_private: users.encryptedUserRsaPrivate,
        })
        .from(users)
        .where(eq(users.id, id))
        .limit(1);

    if (!result) {
        throw new Error('Error fetching user keys: user with id not found');
    }

    return result;
}

export default getUserKeysService;