import db from '../db/db';

export async function getIdByUsername(username: string): Promise<string | null> {
    const user = await db.oneOrNone(
        'SELECT id FROM srp_users WHERE username = $1',
        [username]
    );
    return user ? user.id : null;
}