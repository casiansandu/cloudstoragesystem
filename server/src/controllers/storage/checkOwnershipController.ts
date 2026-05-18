import isFileOwnerService from "../../services/storage/isFileOwnerService";
import { ApiErrorResponse, ApiSuccessResponse, AuthenticatedRequest, OwnershipTestResult } from "../../types";
import { Response } from 'express';
import { isUuidV4 } from "../../utils/validators";

async function isFileOwnerController(req: AuthenticatedRequest, res: Response<ApiSuccessResponse<OwnershipTestResult> | ApiErrorResponse>) {

    const userId = req.user?.id;
    if (!userId) {
        res.status(401).json({
            message: 'Unauthorized',
            success: false
        });
        return;
    }

    const fileId = req.params.file_id;
    if (!fileId) {
        res.status(400).json({
            message: 'Bad Request: fileId is required',
            success: false
        });
        return;
    }

    if (!isUuidV4(fileId)) {
        res.status(400).json({ message: 'Invalid file ID', success: false });
        return;
    }

    try {
        const is_owner = await isFileOwnerService(userId, fileId);
        if (!is_owner) {
            res.status(403).json({
                message: 'You do not own this file',
                success: true,
                data: { isOwner: false }
            });
            return;
        }
        res.status(200).json({
            message: 'Ownership check successful',
            success: true,
            data: { isOwner: is_owner }
        });
    } catch (error) {
        console.error('Check file ownership failed:', error);
        res.status(500).json({
            message: "Unable to check file ownership",
            success: false
        });
    }
}

export default isFileOwnerController;