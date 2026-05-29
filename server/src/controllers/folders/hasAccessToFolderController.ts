import { Response } from "express";
import { ApiErrorResponse, ApiSuccessResponse, AuthenticatedRequest } from "../../types";
import { hasAccessToFolderService } from "../../services/folders/hasAccessToFolderService";
import { isUuidV4 } from "../../utils/validators";

type FolderAccessResult = {
	access_id: string;
};

export async function hasAccessToFolderController(
	req: AuthenticatedRequest,
	res: Response<ApiSuccessResponse<FolderAccessResult> | ApiErrorResponse>
): Promise<void> {
	const folder_id = req.params.folderId;
	const user_id = req.user?.id;

	if (!folder_id || !user_id) {
		res.status(400).json({
			message: "Missing folder_id or user_id",
			success: false,
		});
		return;
	}

	if (!isUuidV4(folder_id)) {
		res.status(400).json({ message: "Invalid folder ID", success: false });
		return;
	}

	try {
		const access_id = await hasAccessToFolderService(user_id, folder_id);
		if (!access_id) {
			res.status(403).json({
				message: "Access denied: user does not have access to the folder",
				success: false,
			});
			return;
		}

		res.status(200).json({
			message: "Folder access check completed successfully",
			data: {
				access_id,
			},
			success: true,
		});
	} catch (error) {
		console.error("Check folder access failed:", error);
		res.status(500).json({
			message: "Unable to check folder access",
			success: false,
		});
	}
}

export default hasAccessToFolderController;
