import db from '../db/db.js';
import { User } from '../types/index.js';

export async function getAllUsersService(): Promise<User[]> {
  const users = await db.manyOrNone<User>('SELECT * FROM users');
  return users || [];
}

export default getAllUsersService;
