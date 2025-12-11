import { SrpUser } from '../types/index';
import db from '../db/db';
import srp from 'secure-remote-password/server';
import { SrpSessionStore } from '../services/srpSessionStore'; // Import your new store

interface SrpLoginStartResult {
  salt: string;
  server_public: string;
  loginSessionId: string; // The "Ticket" to return to client
}

export async function srpLoginStartService(
  username: string, 
  client_public: string // This is 'A'
): Promise<SrpLoginStartResult> {
  console.log(`Starting SRP login for user: ${username}`);
    
  const srp_user = await db.oneOrNone<Pick<SrpUser, 'id' | 'srp_salt' | 'srp_verifier'>>(
    'SELECT * FROM srp_users WHERE username = $1',
    [username]
  );

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