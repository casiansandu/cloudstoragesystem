import { ApiErrorResponse, ApiSuccessResponse, StartHybridFileUploadRequest } from "../types";
import startHybridUploadService from "../services/startHybridUploadService";
import { Response } from "express";

interface StartUploadDataResult {
    file_id: string;
    access_id: string;
}

export async function startHybridUploadController(
    req: StartHybridFileUploadRequest,
    res: Response<ApiSuccessResponse<StartUploadDataResult> | ApiErrorResponse>
): Promise<void> {
    const id = req.user?.id;
    if (!id) {
        res.status(401).json({ message: 'Unauthorized', success: false });
        return;
    }
    console.log('Request body:', req.body);

    const {name, path, file_size, encrypted_file_key, encrypted_manifest_key, x25519_ephemeral_public, mlkem_ciphertext, share_duration} = req.body;

    if (!name || !path || !file_size || !encrypted_file_key || !encrypted_manifest_key || !x25519_ephemeral_public || !mlkem_ciphertext 
        || (share_duration === undefined || share_duration === null)) {
        res.status(400).json({ message: 'Missing parameters', success: false });
        return;
    }
    
    try {
        const { file_id, access_id } = await startHybridUploadService(
            name, 
            id, 
            path, 
            file_size, 
            encrypted_file_key, 
            encrypted_manifest_key,
            share_duration,
            x25519_ephemeral_public,
            mlkem_ciphertext
        );

        res.status(200).json({ message: 'Upload started', success: true, data: { file_id, access_id } });
        return;
    } catch (error) {
        res.status(500).json({ message: (error as Error).message, success: false });
        return;
    }
        
} 