import db from '../db/db.js';
import jwt from 'jsonwebtoken';
import { JWT_SECRET } from '../config/config.js';
import { JwtPayload, Session } from '../types/index.js';

export async function verifyJWT(token: string): Promise<Pick<JwtPayload, 'id' | 'username'>> {
  const sessionUser = await db.oneOrNone<Session>(
    'SELECT username FROM sessions WHERE token = $1',
    [token]
  );

  if (!sessionUser) {
    throw new Error('User not logged in');
  }

  let payload: JwtPayload;
  try {
    payload = jwt.verify(token, JWT_SECRET) as JwtPayload;
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      throw new Error('Token expired');
    }
    throw new Error('Invalid token');
  }

  return { id: payload.id, username: payload.username };
}

export default verifyJWT;
