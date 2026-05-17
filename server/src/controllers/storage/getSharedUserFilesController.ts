import getSharedUserFilesService from "../../services/storage/getSharedUserFilesService";
import { ApiErrorResponse, ApiSuccessResponse, GetAllFilesData } from "../../types";
import verifyJwtToken from "../../services/auth/verifyJwt";
import { Request, Response } from "express";

export async function getSharedUserFilesController(
    req: Request,
    res: Response<ApiSuccessResponse<GetAllFilesData> | ApiErrorResponse>
): Promise<void> {
    const token = req.cookies?.token;

    if (!token) {
        res.status(400).json({ message: "No token", success: false });
        return;
    }

    try {
        const { id } = await verifyJwtToken(token);
        const files = await getSharedUserFilesService(id);

        res.status(200).json({ message: "Shared files retrieved successfully", data: { files }, success: true });
        return;
    } catch (error) {
        res.status(500).json({ message: (error as Error).message, success: false });
        return;
    }
}
