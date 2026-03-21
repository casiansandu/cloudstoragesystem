import db from "../db/db";

import { GetEncryptedSeedResult } from "../types";

async function getEncryptedSeedService(id: string): Promise<GetEncryptedSeedResult> {

    const result: GetEncryptedSeedResult | null = await db.oneOrNone<GetEncryptedSeedResult>(
        `SELECT encrypted_seed FROM srp_users WHERE id = $1`,
        [id]
    );

    if (!result) {
        throw new Error('Error fetching user keys: user with id not found');
    }

    return result;
}

export default getEncryptedSeedService;