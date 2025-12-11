import getAllUserFilesService from "../services/getAllUserFilesService";
import { ApiErrorResponse, ApiSuccessResponse } from "../types";
import verifyJwtToken from "../services/verifyJwt";
import { Request, Response } from 'express';

interface GetAllFilesSuccessData {
    files: Array<{
        filename: string;
    }>;
}


export async function getAllUserFilesController(
    req: Request, 
    res: Response<ApiSuccessResponse<GetAllFilesSuccessData> | ApiErrorResponse>) : Promise<void> {
    const token = req.cookies?.token;
    
    if (!token) {
        res.status(400).json({ message: 'No token', success: false });
        return;
    }

    try {
        const { username } = await verifyJwtToken(token);
        const files = await getAllUserFilesService(username);
        res.status(200).json({ message: 'Files retrieved successfully', data: { files }, success: true });
        return;
    } catch (error) {
        res.status(500).json({
            message: (error as Error).message,
            success: false
        });
        return;
    }

}

