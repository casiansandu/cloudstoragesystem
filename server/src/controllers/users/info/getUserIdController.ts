import { ApiErrorResponse, ApiSuccessResponse, AuthenticatedRequest } from "../../../types";
import { Response } from 'express';
import { getIdByUsername } from "../../../services/users/info/getIdByUsername";


export async function getUserIdController(
    req: AuthenticatedRequest, 
    res: Response<ApiSuccessResponse<{ user_id: string }> | ApiErrorResponse>) : Promise<void> {

    const user_id = req.user?.id;
    const username = req.params.username;

    if (!user_id) {
        res.status(401).json({ message: 'Unauthorized', success: false });
        return;
    }

    try {
        const userId = await getIdByUsername(username);

        if (!userId) {
            res.status(404).json({ message: 'User not found', success: false });
            return;
        }
        
        res.status(200).json({ message: 'User ID retrieved successfully', data: { user_id: userId }, success: true });
        return;
    } catch (error) {
        console.error('Get user ID failed:', error);
        res.status(500).json({ message: 'Unable to retrieve user ID', success: false });
        return;
    }
}