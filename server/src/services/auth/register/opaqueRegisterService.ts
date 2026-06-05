import * as opaque from "@serenity-kit/opaque";
import db from '../../../db/db';
import { users } from '../../../db/schema';
import config from '../../../config/config';

const serverSetup = config.OPAQUE_SERVER_SETUP;

export async function opaqueRegisterInitService(username: string, registrationRequest: string) {
  const { registrationResponse } = opaque.server.createRegistrationResponse({
    serverSetup,
    userIdentifier: username,
    registrationRequest,
  });
  return { registrationResponse };
}

export async function opaqueRegisterFinishService(userData: any) {

  const [createdUser] = await db
    .insert(users)
    .values({
      username: userData.username,
      email: userData.email,
      opaqueRegistrationRecord: userData.registrationRecord, 
      kdfSalt: userData.kdf_salt,
      userRsaPublic: userData.user_rsa_public,
      encryptedUserRsaPrivate: userData.encrypted_user_rsa_private,
      publicKeysBundle: userData.public_keys_bundle,
      encryptedSeed: userData.encrypted_seed,
      encryptedArk: userData.encrypted_ark,
    })
    .returning({ id: users.id });

  return { username: userData.username, id: createdUser.id };
}

