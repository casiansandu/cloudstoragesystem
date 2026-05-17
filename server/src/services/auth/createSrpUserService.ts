import db from '../../db/db';
import { SrpUserRegistration, UserCreationResult } from '../../types';
import { eq } from 'drizzle-orm';
import { users } from '../../db/schema';

export async function createSrpUserService(userData: SrpUserRegistration): Promise<UserCreationResult> {
  const { 
    username,
    email,
    srp_salt,
    srp_verifier,
    kdf_salt,
    encrypted_user_rsa_private,
    user_rsa_public,
    public_keys_bundle,
    encrypted_seed,
    encrypted_ark
  } = userData;

  // Legacy SQL: SELECT * FROM srp_users WHERE username = $1
  const checkUsername = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.username, username))
    .limit(1);

  // Legacy SQL: SELECT * FROM srp_users WHERE email = $1
  const checkEmail = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  if (checkUsername.length > 0) {
    throw new Error(`User with username ${username} already exists.`);
  }

  if (checkEmail.length > 0) {
    throw new Error(`User with email ${email} already exists.`);
  }

  // Legacy SQL: INSERT INTO srp_users(...) VALUES(...) RETURNING id
  const [createdUser] = await db
    .insert(users)
    .values({
      username,
      email,
      srpSalt: srp_salt,
      srpVerifier: srp_verifier,
      kdfSalt: kdf_salt,
      userRsaPublic: user_rsa_public,
      encryptedUserRsaPrivate: encrypted_user_rsa_private,
      publicKeysBundle: public_keys_bundle,
      encryptedSeed: encrypted_seed,
      encryptedArk: encrypted_ark,
    })
    .returning({ id: users.id });

  return { username, id: createdUser.id };
}

export default createSrpUserService;
