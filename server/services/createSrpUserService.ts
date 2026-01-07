import db from '../db/db';
import { SrpUserRegistration, UserCreationResult, User } from '../types';

export async function createSrpUserService(userData: SrpUserRegistration): Promise<UserCreationResult> {
  const { 
    username,
    email,
    srp_salt,
    srp_verifier,
    encryption_salt,
    encrypted_private_key,
    encryption_public_key
  } = userData;

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
    'INSERT INTO srp_users(username, email, srp_salt, srp_verifier, encryption_salt, encryption_public_key, encrypted_private_key) VALUES($1, $2, $3, $4, $5, $6, $7)',
    [username, email, 
      srp_salt, srp_verifier, 
      encryption_salt, encryption_public_key, encrypted_private_key]
  );

  return { username, email };
}

export default createSrpUserService;
