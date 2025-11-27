import db from '../db/db';
import { User } from '../types';

export async function getAllUsersService(): Promise<User[]> {
  const users = await db.manyOrNone<User>('SELECT * FROM users');
  return users || [];
}

export default getAllUsersService;
