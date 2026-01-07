import db from "../db/db";

import { GetKeysResult } from "../types";

async function getUserKeysService(id: string): Promise<GetKeysResult> {

    const result: GetKeysResult | null = await db.oneOrNone<GetKeysResult>(
        `SELECT encryption_salt, encryption_public_key, encrypted_private_key FROM srp_users WHERE id = $1`,
        [id]
    );

    //console.log(`Fetched keys for user ID ${id}: result =`, result);

    if (!result) {
        throw new Error('Error fetching user keys: user with id not found');
    }

    return result;
}

export default getUserKeysService;