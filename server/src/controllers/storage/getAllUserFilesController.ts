import getAllUserFilesService from "../../services/storage/getAllUserFilesService";
import { ApiErrorResponse, ApiSuccessResponse, GetAllFilesData } from "../../types";
import verifyJwtToken from "../../services/auth/verifyJwt";
import { Request, Response } from 'express';


export async function getAllUserFilesController(
    req: Request, 
    res: Response<ApiSuccessResponse<GetAllFilesData> | ApiErrorResponse>) : Promise<void> {
    const token = req.cookies?.token;
    
    if (!token) {
        res.status(400).json({ message: 'No token', success: false });
        return;
    }

    try {
        const { id } = await verifyJwtToken(token);
        const files = await getAllUserFilesService(id);
        
        res.status(200).json({ message: 'Files retrieved successfully', data: { files }, success: true });
        return;
    } catch (error) {
        console.error('Get all user files failed:', error);
        res.status(500).json({ message: 'Unable to retrieve files', success: false });
        return;
    }

}

