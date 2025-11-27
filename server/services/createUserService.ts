import { hashPassword } from '../utils/password';
import db from '../db/db';
import { UserRegistration, UserCreationResult, User } from '../types';

export async function createUserService(userData: UserRegistration): Promise<UserCreationResult> {
  const { username, email, password } = userData;

  const checkUsername = await db.oneOrNone<User>(
    'SELECT * FROM users WHERE username = $1',
    [username]
  );

  const checkEmail = await db.oneOrNone<User>(
    'SELECT * FROM users WHERE email = $1',
    [email]
  );

  if (checkUsername) {
    throw new Error(`User with username ${username} already exists.`);
  }

  if (checkEmail) {
    throw new Error(`User with email ${email} already exists.`);
  }

  const hashedPassword = await hashPassword(password);

  await db.none(
    'INSERT INTO users(username, email, password_hash) VALUES($1, $2, $3)',
    [username, email, hashedPassword]
  );

  return { username, email };
}

export default createUserService;
