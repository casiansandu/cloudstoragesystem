import { srpLoginStartService } from "../../services/auth/srpLoginStartService";
import { srpLoginVerifyService } from "../../services/auth/srpLoginVerifyService";
import { ApiErrorResponse, ApiSuccessResponse, SrpLoginStartRequest, SrpLoginVerifyRequest } from "../../types";
import { Response } from 'express';

interface SrpLoginStartSuccessData {
    salt: string;
    server_public: string;
    loginSessionId: string;
}

interface SrpLoginVerifySuccessData {
    server_session_proof: string;
}

export async function srpLoginStart(
    req: SrpLoginStartRequest, 
    res: Response<ApiSuccessResponse<SrpLoginStartSuccessData> | ApiErrorResponse>) : Promise<void> {

    if (!req.body.username || !req.body.client_public) {
        res.status(400).json({ message: 'Username and client_public are required', success: false });
        return;
    }
    try {
        const { salt, server_public, loginSessionId } = await srpLoginStartService(req.body.username, req.body.client_public);
        res.status(200).json({
            message: 'Srp Login Start successful',
            data: {
                salt, server_public, loginSessionId
            },
            success: true
        });
        return;
    } catch (error) {
        console.error('SRP login start failed:', error);
        res.status(500).json({ message: 'Login failed', success: false });
        return;
    }
}

export async function srpLoginVerify(
    req: SrpLoginVerifyRequest, 
    res: Response<ApiSuccessResponse<SrpLoginVerifySuccessData> | ApiErrorResponse>
) {

    if (!req.body.loginSessionId || !req.body.client_session_proof) {
        res.status(400).json({ message: 'loginSessionId and clientSessionProof are required', success: false });
        return;
    }

    try {
        const { server_session_proof, token } = await srpLoginVerifyService(
            req.body.loginSessionId, 
            req.body.client_session_proof
        );

        res.cookie('token', token, {
            httpOnly: true,
            secure: true,
            sameSite: 'strict',
            maxAge: 3600000
        });

        res.status(200).json({
            message: 'Srp Login Verify successful',
            data: { server_session_proof },
            success: true
        });
        return;
    } catch (error) {
        console.error('SRP login verify failed:', error);
        res.status(500).json({ message: 'Login failed', success: false });
        return;
    }
}