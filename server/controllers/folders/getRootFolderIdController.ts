import { Response } from 'express';
import { getRootFolderIdService } from '../../services/folders/getRootFolderInfoService'
import { ApiErrorResponse, AuthenticatedRequest, ApiSuccessResponse } from '../../types';

interface GetRootFolderIdRequest extends AuthenticatedRequest {}

interface GetRootFolderIdResponseData {
    root_folder_id: string;
}

export async function getRootFolderIdController(
    req: GetRootFolderIdRequest,
    res: Response<ApiSuccessResponse<GetRootFolderIdResponseData> | ApiErrorResponse>
): Promise<void> {
    const user_id = req.user!.id;

    if (!user_id) {
        res.status(400).json({
            message: 'Missing required field: user_id is required.',
            success: false
        });
        return;
    }

    try {
        const root_folder_info = await getRootFolderIdService(user_id);

        res.status(200).json({
            message: 'Root folder info retrieved successfully',
            data: {
                root_folder_id: root_folder_info.root_folder_id
            },
            success: true
        });
    } catch (error) {
        res.status(500).json({
            message: (error as Error).message,
            success: false
        });
    }
}

export default getRootFolderIdController;