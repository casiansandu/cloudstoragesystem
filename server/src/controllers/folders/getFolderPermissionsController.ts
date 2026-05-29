import { Response } from "express";
import { ApiErrorResponse, ApiSuccessResponse, AuthenticatedRequest } from "../../types";
import { getFolderPermissionsService } from "../../services/folders/getFolderPermissionsService";
import { isUuidV4 } from "../../utils/validators";

type FolderPermissionsResult = {
  permissions: {
    can_download: boolean;
    can_upload: boolean;
    can_share: boolean;
    can_delete: boolean;
  };
};

export async function getFolderPermissionsController(
  req: AuthenticatedRequest,
  res: Response<ApiSuccessResponse<FolderPermissionsResult> | ApiErrorResponse>
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
    const permissions = await getFolderPermissionsService(user_id, folder_id);
    if (!permissions) {
      res.status(403).json({
        message: "Access denied: user does not have permissions for this folder",
        success: false,
      });
      return;
    }

    res.status(200).json({
      message: "Folder permissions retrieved successfully",
      data: { permissions },
      success: true,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to retrieve folder permissions";
    if (message === "Folder not found") {
      res.status(404).json({ message, success: false });
      return;
    }

    console.error("Get folder permissions failed:", error);
    res.status(500).json({
      message: "Unable to retrieve folder permissions",
      success: false,
    });
  }
}

export default getFolderPermissionsController;
