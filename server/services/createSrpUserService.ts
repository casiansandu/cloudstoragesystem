import db from '../db/db';
import { SrpUserRegistration, UserCreationResult, User } from '../types';
//import {srp} from 'secure-remote-password/server'; 

export async function createSrpUserService(userData: SrpUserRegistration): Promise<UserCreationResult> {
  const { username, email, salt, verifier } = userData;

  const checkUsername = await db.oneOrNone<User>(
    'SELECT * FROM srp_users WHERE username = $1',
    [username]
  );

  const checkEmail = await db.oneOrNone<User>(
    'SELECT * FROM srp_users WHERE email = $1',
    [email]
  );

  if (checkUsername) {
    throw new Error(`User with username ${username} already exists.`);
  }

  if (checkEmail) {
    throw new Error(`User with email ${email} already exists.`);
  }

  await db.none(
    'INSERT INTO srp_users(username, email, salt, verifier) VALUES($1, $2, $3, $4)',
    [username, email, salt, verifier]
  );

  return { username, email };
}

export default createSrpUserService;
