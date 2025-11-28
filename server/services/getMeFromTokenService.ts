
import { SrpUser } from '../types/index';
import db from '../db/db';
import decodeJwtToken from './decodeJwtToken';

export async function getMeFromTokenService(token: string): Promise<Pick<SrpUser, "username" | "email">> {

    const { username } = await decodeJwtToken(token);
    
    const user = await db.oneOrNone<SrpUser>(
        'SELECT username, email FROM srp_users WHERE username = $1',
        [username]
    );

    if (!user) {
        throw new Error('User not found');
    }

    return user;
}