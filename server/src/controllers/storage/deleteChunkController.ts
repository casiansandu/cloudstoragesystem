import { ApiErrorResponse, ApiSuccessResponse, AuthenticatedRequest } from "../../types";
import { Response } from 'express';
//import deleteChunkService from "../services/deleteChunkService";


async function deleteChunkController(req: AuthenticatedRequest, res: Response<ApiSuccessResponse<void> | ApiErrorResponse>) {
    const userId = req.user?.id;
    if (!userId) {
        res.status(401).json({
            message: 'Unauthorized',
            success: false
        });
        return;
    }

    const chunkId = req.params.chunk_id;
    if (!chunkId) {
        res.status(400).json({
            message: 'Bad Request: chunkId is required',
            success: false
        });
        return;
    }

    try {
        //await deleteChunkService(userId, chunkId);

        res.status(200).json({
            message: 'Chunk deleted successfully',
            success: true
        });
    } catch (error) {
        res.status(500).json({
            message: "Unable to delete chunk",
            success: false,
            error: (error as Error).message
        });
    }
}

export default deleteChunkController;