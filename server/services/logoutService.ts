import db from '../db/db.js';
import { LogoutResult } from '../types/index.js';

export async function logoutService(username: string): Promise<LogoutResult> {
  await db.none('DELETE FROM sessions WHERE username = $1', [username]);
  return { username };
}

export default logoutService;
