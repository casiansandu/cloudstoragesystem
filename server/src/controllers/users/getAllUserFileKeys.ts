import {Response} from 'express';
import { ApiErrorResponse, ApiSuccessResponse, AuthenticatedRequest, GetFileKeysResult } from "../../types";
import getAllUserFileKeysService from '../../services/users/getAllUserFileKeysService';

export async function getAllUserFileKeysController(
    req: AuthenticatedRequest, 
    res: Response<ApiSuccessResponse<{ fileKeysData: Array<GetFileKeysResult> }> | ApiErrorResponse>
): Promise<void> {
    const user_id = req.user!.id;

    if (!user_id) {
        res.status(400).json({
            message: 'Missing user_id',
            success: false
        });
        return;
    }
    try {
        const fileKeys = await getAllUserFileKeysService(user_id);
        res.status(200).json({ 
            message: 'All user file keys retrieved successfully',
            data: {
                fileKeysData: fileKeys,
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

export default getAllUserFileKeysController;