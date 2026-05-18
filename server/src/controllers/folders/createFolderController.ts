import { Response } from 'express';
import { ApiErrorResponse, AuthenticatedRequest, ApiSuccessResponse } from '../../types';
import { createFolderService } from '../../services/folders/createFolderService';

interface CreateFolderRequest extends AuthenticatedRequest {
    body: {
        encrypted_key_data: string;
        parent_folder_id?: string;
        encrypted_folder_name_data?: string;
    };
}

function validateCreateFolderRequest(encrypted_key_data: string, parent_folder_id?: string, encrypted_folder_name_data?: string): string | null {
    if (!encrypted_key_data) {
        return 'Missing required fields: encrypted_key_data is required.';
    }

    // if ((!parent_folder_id && encrypted_folder_name_data) || (parent_folder_id && !encrypted_folder_name_data)) {
    //     return 'Both parent_folder_id and encrypted_folder_name_data must be provided together.';
    // }

    return null;
}

export async function createFolderController(
    req: CreateFolderRequest, 
    res: Response<ApiSuccessResponse<{ folder_id: string }> | ApiErrorResponse>
): Promise<void> {
    const { encrypted_key_data, parent_folder_id, encrypted_folder_name_data } = req.body;
    const user_id = req.user!.id;

    const validationError = validateCreateFolderRequest(encrypted_key_data, parent_folder_id, encrypted_folder_name_data);
    if (validationError) {
        res.status(400).json(
            { 
                message: validationError, 
                success: false 
            }
        );
        return;
    }

    try {
        const creation_res = await createFolderService(user_id, encrypted_key_data, parent_folder_id, encrypted_folder_name_data);

        res.status(201).json({
            message: 'Folder created successfully',
            data: { folder_id: creation_res.folder_id },
            success: true
        });
    } catch (error) {
        console.error('Create folder failed:', error);
        res.status(500).json({
            message: 'Unable to create folder',
            success: false
        });
    }
}

export default createFolderController;


