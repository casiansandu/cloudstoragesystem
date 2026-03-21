import db from '../db/db';
import { SrpUser, User } from '../types';

export async function existsUserService(username: string): Promise<boolean> {
  const user = await db.oneOrNone<SrpUser>(
    'SELECT * FROM srp_users WHERE username = $1',
    [username]
  );

  return user !== null;
}

export default existsUserService;
