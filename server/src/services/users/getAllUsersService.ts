import db from '../../db/db';
import { User } from '../../types';
import { users } from '../../db/schema';

export async function getAllUsersService(): Promise<User[]> {
  // Legacy SQL: SELECT * FROM users
  const allUsers = await db.select().from(users);
  return allUsers as unknown as User[];
}

export default getAllUsersService;
