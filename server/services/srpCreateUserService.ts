import db from '../db/db.js';
import { SrpUserRegistration, SrpUserCreationResult, User } from '../types/index.js';


export async function srpCreateUserService(userData: SrpUserRegistration): Promise<SrpUserCreationResult> {
  const { username, email, password, salt, verifier } = userData;

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

  await db.none(
    `INSERT INTO srp_users (username, email, salt, verifier)
     VALUES ($1, $2, $3, $4)`,
    [username, email, salt, verifier]
  );

  return { username, email };
}

export default srpCreateUserService;
