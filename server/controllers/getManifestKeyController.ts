import {Response} from "express";
import { ApiErrorResponse, ApiSuccessResponse, AuthenticatedRequest, GetManifestKeyResult } from "../types";
import getManifestKeyService from '../services/getManifestKeyService';

export default async function getManifestKeyController(
    req: AuthenticatedRequest,
    res: Response<ApiSuccessResponse<GetManifestKeyResult> | ApiErrorResponse>): Promise<void> {

    const id = req.user?.id;

    const file_id = req.params.file_id;

    if (!file_id || !id) {
        res.status(400).json({
            message: 'Missing file_id or user_id',
            success: false
        });
        return;
    }

    try {
        const manifestKey = await getManifestKeyService(id, file_id);
        res.status(200).json({ 
            message: 'Manifest key retrieved successfully',
            data: {
                encrypted_manifest_key: manifestKey,
            }, 
            success: true });
        return;
    } catch (error) {
        res.status(500).json({
            message: (error as Error).message,
            success: false
        });
        return;
    }

}