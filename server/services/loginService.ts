import { comparePasswords } from '../utils/password';
import db from '../db/db';
import jwt from 'jsonwebtoken';
import { JWT_SECRET } from '../config/config';
import { UserLogin, LoginResult, User, Session, JwtPayload } from '../types';

export async function loginService(credentials: UserLogin): Promise<LoginResult> {
  const { username, password } = credentials;

  const user = await db.oneOrNone<User>(
    'SELECT * FROM users WHERE username = $1',
    [username]
  );

  if (!user) {
    throw new Error('Username not registered');
  }

  const passwordsMatch = await comparePasswords(password, user.password_hash);

  if (!passwordsMatch) {
    throw new Error('Invalid password');
  }

  const isLoggedIn = await db.oneOrNone<Session>(
    'SELECT username FROM sessions WHERE username = $1',
    [username]
  );

  if (isLoggedIn) {
    try {
      jwt.verify(isLoggedIn.token, JWT_SECRET);
      throw new Error('User already logged in');
    }
    catch {
      await db.none('DELETE FROM sessions WHERE username = $1', [username]);
    }
  }

  const payload: JwtPayload = {
    id: user.id,
    username: user.username
  };

  const token = jwt.sign(payload, JWT_SECRET, {
    expiresIn: '1h',
  });

  await db.none('INSERT INTO sessions VALUES($1, $2)', [username, token]);

  return { username, token };
}

export default loginService;
