import db from "../db/db";

import { GetPublicKeyResult } from "../types";

async function getPublicKeyService(id: string): Promise<GetPublicKeyResult> {

    const result: GetPublicKeyResult | null = await db.oneOrNone<GetPublicKeyResult>(
        `SELECT user_rsa_public FROM srp_users WHERE id = $1`,
        [id]
    );

    if (!result) {
        throw new Error('Error fetching user keys: user with id not found');
    }

    return result;
}

export default getPublicKeyService;