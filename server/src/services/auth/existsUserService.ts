import db from '../../db/db';
import { eq } from 'drizzle-orm';
import { users } from '../../db/schema';

export async function existsUserService(username: string): Promise<boolean> {
  // Legacy SQL: SELECT * FROM srp_users WHERE username = $1
  const user = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.username, username))
    .limit(1);

  return user.length > 0;
}

export default existsUserService;
