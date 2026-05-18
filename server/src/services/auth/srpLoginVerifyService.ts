import srp from 'secure-remote-password/server';
import { SrpSessionStore } from './srpSessionStore';
import jwt from 'jsonwebtoken';

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
        const jwtSecret = process.env.JWT_SECRET;
        if (!jwtSecret) {
            throw new Error('JWT secret is not configured');
        }

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
            jwtSecret,
            { expiresIn: '1h' }
        );

        return {
            server_session_proof: serverSession.proof,
            token: token
        };

    } catch (error) {
        await SrpSessionStore.delete(loginSessionId);
        throw new Error('Invalid password or session proof');
    }
}