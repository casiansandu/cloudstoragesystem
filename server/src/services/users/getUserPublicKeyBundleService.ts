import db from "../../db/db";
import { eq } from 'drizzle-orm';
import { users } from '../../db/schema';

import { GetPublicKeyBundleResult } from "../../types";

async function getPublicKeyBundleService(id: string): Promise<GetPublicKeyBundleResult> {

    // Legacy SQL: SELECT public_keys_bundle FROM srp_users WHERE id = $1
    const [result] = await db
        .select({ public_keys_bundle: users.publicKeysBundle })
        .from(users)
        .where(eq(users.id, id))
        .limit(1);

    if (!result) {
        throw new Error('Error fetching user keys: user with id not found');
    }

    return result;
}

export default getPublicKeyBundleService;