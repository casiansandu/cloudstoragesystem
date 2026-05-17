import { Response } from "express";
import { ApiErrorResponse, ApiSuccessResponse, AuthenticatedRequest, GetFileMasterKeyResult } from "../../types";
import getFileMasterKeyService from '../../services/storage/getFileMasterKeyService';
import hasAccessToFileService from "../../services/storage/hasAccessToFileService";

async function getFileMasterKeyController(req: AuthenticatedRequest, res: Response<ApiSuccessResponse<GetFileMasterKeyResult> | ApiErrorResponse>): Promise<void> {
    
    const file_id = req.params.file_id;
    const user_id = req.user!.id;

    if (!file_id || !user_id) {
        res.status(400).json({
            message: 'Missing file_id or user_id',
            success: false
        });
        return;
    }

    try {
        const hasaccess = await hasAccessToFileService(user_id, file_id);
        if (!hasaccess) {
            res.status(403).json({
                message: 'Access denied: user is not the owner of the file',
                success: false
            });
            return;
        }

        const masterKey = await getFileMasterKeyService(user_id, file_id);    
        
        res.status(200).json({ 
            message: 'File master key retrieved successfully',
            data: {
                encrypted_file_key: masterKey,
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

export default getFileMasterKeyController;