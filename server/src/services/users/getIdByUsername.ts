import db from '../../db/db';
import { eq } from 'drizzle-orm';
import { users } from '../../db/schema';

export async function getIdByUsername(username: string): Promise<string | null> {
    // Legacy SQL: SELECT id FROM srp_users WHERE username = $1
    const [user] = await db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.username, username))
        .limit(1);
    return user ? user.id : null;
}