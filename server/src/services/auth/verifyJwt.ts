
import jwt from 'jsonwebtoken';
import { JWT_SECRET } from '../../config/config';
import { JwtPayload } from '../../types';

export async function verifyJwt(token: string): Promise<Pick<JwtPayload, 'id' | 'username'>> {

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

export default verifyJwt;