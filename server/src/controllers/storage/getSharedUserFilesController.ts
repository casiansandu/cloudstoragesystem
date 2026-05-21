import getSharedUserFilesService from "../../services/storage/getSharedUserFilesService";
import { ApiErrorResponse, ApiSuccessResponse, AuthenticatedRequest, GetAllFilesData } from "../../types";
import { Response } from "express";

export async function getSharedUserFilesController(
    req: AuthenticatedRequest,
    res: Response<ApiSuccessResponse<GetAllFilesData> | ApiErrorResponse>
): Promise<void> {

    const user_id = req.user?.id;

    if (!user_id) {
        res.status(401).json({ message: 'Unauthorized', success: false });
        return;
    }

    try {
        const files = await getSharedUserFilesService(user_id);

        res.status(200).json({ message: "Shared files retrieved successfully", data: { files }, success: true });
        return;
    } catch (error) {
        console.error('Get shared files failed:', error);
        res.status(500).json({ message: 'Unable to retrieve shared files', success: false });
        return;
    }
}
