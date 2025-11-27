import db from '../db/db';
import { User } from '../types';

export async function existsUserService(username: string): Promise<boolean> {
  const user = await db.oneOrNone<User>(
    'SELECT * FROM users WHERE username = $1',
    [username]
  );

  return user !== null;
}

export default existsUserService;
