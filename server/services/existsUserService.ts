import db from '../db/db.js';
import { User } from '../types/index.js';

export async function existsUserService(username: string): Promise<boolean> {
  const user = await db.oneOrNone<User>(
    'SELECT * FROM users WHERE username = $1',
    [username]
  );

  return user !== null;
}

export default existsUserService;
