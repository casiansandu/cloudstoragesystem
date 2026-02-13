import { Response } from 'express';
import { ApiErrorResponse, AuthenticatedRequest, ApiSuccessResponse } from '../../types';
import { getRootFolderIdService } from '../../services/folders/getRootFolderInfoService';

export async function checkRootFolderExistsController(
    req: AuthenticatedRequest,
    res: Response<ApiSuccessResponse<{ exists: boolean }> | ApiErrorResponse>
): Promise<void> {
    const user_id = req.user!.id;
    if (!user_id) {
        res.status(401).json({ success: false, message: 'Unauthorized' });
        return;
    }
    let id = "";
    try {
        id = (await getRootFolderIdService(user_id)).root_folder_id;
    } catch (error) {
        id = "";
    }


    try {
        const exists = (id != ""); // Convert to boolean
        console.log(`Root folder existence for user ${user_id}: ${exists}`);
        res.status(200).json({ success: true, data: { exists }, message: 'Root folder existence checked successfully' });
    } catch (error) {
        res.status(500).json({ success: false, message: (error as Error).message });
    }
}