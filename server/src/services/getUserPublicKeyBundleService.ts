import db from "../db/db";

import { GetPublicKeyBundleResult } from "../types";

async function getPublicKeyBundleService(id: string): Promise<GetPublicKeyBundleResult> {

    const result: GetPublicKeyBundleResult | null = await db.oneOrNone<GetPublicKeyBundleResult>(
        `SELECT public_keys_bundle FROM srp_users WHERE id = $1`,
        [id]
    );

    if (!result) {
        throw new Error('Error fetching user keys: user with id not found');
    }

    return result;
}

export default getPublicKeyBundleService;