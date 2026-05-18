import db from '../../db/db';
import srp from 'secure-remote-password/server';
import { SrpSessionStore } from '../../services/auth/srpSessionStore'; // Import your new store
import { eq } from 'drizzle-orm';
import { users } from '../../db/schema';

interface SrpLoginStartResult {
  salt: string;
  server_public: string;
  loginSessionId: string; // The "Ticket" to return to client
}

export async function srpLoginStartService(
  username: string, 
  client_public: string // This is 'A'
): Promise<SrpLoginStartResult> {
    
  // Legacy SQL: SELECT * FROM srp_users WHERE username = $1
  const [srp_user] = await db
    .select({
      id: users.id,
      srp_salt: users.srpSalt,
      srp_verifier: users.srpVerifier,
    })
    .from(users)
    .where(eq(users.username, username))
    .limit(1);

  if (!srp_user) {
    throw new Error('User not found');
  }

  const serverEphemeral = srp.generateEphemeral(srp_user.srp_verifier);
  
  const loginSessionId = await SrpSessionStore.save({
    id: srp_user.id,
    b: serverEphemeral.secret,
    B: serverEphemeral.public,
    A: client_public, 
    v: srp_user.srp_verifier,
    salt: srp_user.srp_salt,
    username: username
  });

  return {
    salt: srp_user.srp_salt,
    server_public: serverEphemeral.public,
    loginSessionId: loginSessionId 
  };
}