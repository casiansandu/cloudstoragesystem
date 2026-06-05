import * as opaque from '@serenity-kit/opaque';
import db from '../../../db/db';
import { eq } from 'drizzle-orm';
import { users } from '../../../db/schema';
import { OpaqueSessionStore } from '../session/opaqueSessionStore';
import config from '../../../config/config';
import jwt from 'jsonwebtoken';

const serverSetup = config.OPAQUE_SERVER_SETUP;

interface OpaqueLoginStartResult {
  loginResponse: string;
  loginSessionId: string;
}

export async function opaqueLoginStartService(
  username: string, 
  startLoginRequest: string
): Promise<OpaqueLoginStartResult> {
  
  const [user] = await db
    .select({
      id: users.id,
      opaqueRegistrationRecord: users.opaqueRegistrationRecord,
    })
    .from(users)
    .where(eq(users.username, username))
    .limit(1);

  if (!user) {
    throw new Error('User not found');
  }

  const { loginResponse, serverLoginState } = opaque.server.startLogin({
    userIdentifier: username,
    registrationRecord: user.opaqueRegistrationRecord,
    serverSetup,
    startLoginRequest,
  });

  const loginSessionId = await OpaqueSessionStore.save({
    id: user.id,
    username: username,
    serverLoginState: serverLoginState
  });

  return {
    loginResponse,
    loginSessionId
  };
}


interface OpaqueLoginVerifyResult {
  token: string;
}

export async function opaqueLoginVerifyService(
  loginSessionId: string,
  finishLoginRequest: string
): Promise<OpaqueLoginVerifyResult> {

  // 1. Retrieve the temporary server state
  const sessionData = await OpaqueSessionStore.get(loginSessionId);

  if (!sessionData) {
    throw new Error('Login session expired or invalid. Please try logging in again.');
  }

  try {
    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
      throw new Error('JWT secret is not configured');
    }

    const { sessionKey } = opaque.server.finishLogin({
      finishLoginRequest,
      serverLoginState: sessionData.serverLoginState,
    });

    await OpaqueSessionStore.delete(loginSessionId);

    const token = jwt.sign(
      { id: sessionData.id, username: sessionData.username },
      jwtSecret,
      { expiresIn: '1h' }
    );

    return { token };

  } catch (error) {
    await OpaqueSessionStore.delete(loginSessionId);
    throw new Error('Invalid credentials or session proof');
  }
}

