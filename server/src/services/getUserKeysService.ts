import db from "../db/db";

import { GetKeysResult } from "../types";

async function getUserKeysService(id: string): Promise<GetKeysResult> {

    const result: GetKeysResult | null = await db.oneOrNone<GetKeysResult>(
        `SELECT kdf_salt, user_rsa_public, encrypted_user_rsa_private FROM srp_users WHERE id = $1`,
        [id]
    );

    //console.log(`Fetched keys for user ID ${id}: result =`, result);

    if (!result) {
        throw new Error('Error fetching user keys: user with id not found');
    }

    return result;
}

export default getUserKeysService;