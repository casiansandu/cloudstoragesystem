import getAllUserFilesService from "../../../services/files/info/getAllUserFilesService";
import { ApiErrorResponse, ApiSuccessResponse, AuthenticatedRequest, GetAllFilesData } from "../../../types";
import verifyJwtToken from "../../../services/auth/access/verifyJwt";
import { Request, Response } from 'express';


export async function getAllUserFilesController(
    req: AuthenticatedRequest, 
    res: Response<ApiSuccessResponse<GetAllFilesData> | ApiErrorResponse>) : Promise<void> {

    const user = req.user;

    if (!user) {
        res.status(401).json({ message: 'Unauthorized', success: false });
        return;
    }

    try {
        const files = await getAllUserFilesService(user.id);
        
        res.status(200).json({ message: 'Files retrieved successfully', data: { files }, success: true });
        return;
    } catch (error) {
        console.error('Get all user files failed:', error);
        res.status(500).json({ message: 'Unable to retrieve files', success: false });
        return;
    }

}



