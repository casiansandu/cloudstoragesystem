import srp from 'secure-remote-password/server';
import { SrpSessionStore } from './srpSessionStore';
import jwt from 'jsonwebtoken';
import db from '../db/db';

interface SrpLoginVerifyResult {
    server_session_proof: string;
    token: string;
}

export async function srpLoginVerifyService(
    loginSessionId: string,
    clientSessionProof: string
): Promise<SrpLoginVerifyResult> {

    const sessionData = await SrpSessionStore.get(loginSessionId);

    if (!sessionData) {
        throw new Error('Login session expired or invalid. Please try logging in again.');
    }

    try {
        const serverSession = srp.deriveSession(
            sessionData.b,
            sessionData.A,
            sessionData.salt,
            sessionData.username,
            sessionData.v,
            clientSessionProof
        );

        await SrpSessionStore.delete(loginSessionId);

        const token = jwt.sign(
            { id: sessionData.id, username: sessionData.username },
            process.env.JWT_SECRET as string,
            { expiresIn: '1h' }
        );

        //await db.none('INSERT INTO sessions VALUES($1, $2)', [sessionData.username, token]);

        return {
            server_session_proof: serverSession.proof,
            token: token
        };

    } catch (error) {
        await SrpSessionStore.delete(loginSessionId);
        
        throw new Error('Invalid password or session proof' + (error as Error).message);
    }
}