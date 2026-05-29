import { Response } from 'express';
import db from '../../db/db';
import { ApiErrorResponse, AuthenticatedRequest, ApiSuccessResponse } from '../../types';
import { createFolderService } from '../../services/folders/createFolderService';
import { getFolderAccessForUserService } from '../../services/folders/getFolderAccessForUserService';

interface CreateFolderRequest extends AuthenticatedRequest {
    body: {
        encrypted_key_data_ark: string;
        encrypted_key_data_parent: string;
        parent_folder_id?: string;
        encrypted_folder_name_data?: string;
    };
}

function validateCreateFolderRequest(encrypted_key_data_ark: string, encrypted_key_data_parent: string, parent_folder_id?: string, encrypted_folder_name_data?: string): boolean {
    // Basic validation to ensure required fields are present
    if (!encrypted_key_data_ark || !encrypted_folder_name_data) {
        return false;
    }

    // If parent_folder_id is provided, encrypted_key_data_parent must also be provided, and vice versa
    if ((parent_folder_id !== "" && encrypted_key_data_parent === "") || (parent_folder_id === "" && encrypted_key_data_parent !== "")) {
        return false;
    }

    return true;
}

export async function createFolderController(
    req: CreateFolderRequest, 
    res: Response<ApiSuccessResponse<{ folder_id: string, access_id: string }> | ApiErrorResponse>
): Promise<void> {
    const { encrypted_key_data_ark, encrypted_key_data_parent, parent_folder_id, encrypted_folder_name_data } = req.body;
    const user_id = req.user!.id;

    const isValid = validateCreateFolderRequest(encrypted_key_data_ark, encrypted_key_data_parent, parent_folder_id, encrypted_folder_name_data);
    if (!isValid) {
        res.status(400).json({ 
            message: 'Missing required fields: encrypted_key_data_ark, encrypted_key_data_parent, and encrypted_folder_name_data are required.', 
            success: false 
        });
        return;
    }

    if (parent_folder_id) {
        try {
            const access = await getFolderAccessForUserService(user_id, parent_folder_id);
            if (access.accessType !== "owner" && !access.permissions.can_upload) {
                res.status(403).json({ message: 'Access denied, missing upload permission.', success: false });
                return;
            }
        } catch (error) {
            const message = error instanceof Error ? error.message : "Unable to create folder";
            if (message === "Folder not found") {
                res.status(404).json({ message, success: false });
                return;
            }

            if (message === "Access denied" || message === "Invalid folder ID") {
                res.status(403).json({ message, success: false });
                return;
            }
        }
    }

    try {
        const result = await db.transaction(async (tx) => {
            return await createFolderService(
                user_id, 
                encrypted_key_data_ark,
                encrypted_key_data_parent,
                parent_folder_id, 
                encrypted_folder_name_data,
                tx
            );
        });

        res.status(201).json({
            message: 'Folder created and secured successfully',
            data: { folder_id: result.folder_id, access_id: result.access_id },
            success: true
        });
    } catch (error) {
        console.error('Transactional folder creation failed:', error);
        res.status(500).json({
            message: 'Unable to create folder securely',
            success: false
        });
    }
}

export default createFolderController;