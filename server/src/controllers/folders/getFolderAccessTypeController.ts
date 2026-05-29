import { Response } from "express";
import { ApiErrorResponse, ApiSuccessResponse, AuthenticatedRequest } from "../../types";
import { getFolderAccessForUserService } from "../../services/folders/getFolderAccessForUserService";
import { isUuidV4 } from "../../utils/validators";

type FolderAccessType = "owner" | "shared" | "shared_subfolder";

export async function getFolderAccessTypeController(
  req: AuthenticatedRequest,
  res: Response<ApiSuccessResponse<{ access_type: FolderAccessType }> | ApiErrorResponse>
): Promise<void> {
  const user_id = req.user?.id;
  const folder_id = req.params.folderId;

  if (!user_id) {
    res.status(401).json({ message: "Unauthorized", success: false });
    return;
  }

  if (!folder_id) {
    res.status(400).json({ message: "Missing folder ID", success: false });
    return;
  }

  if (!isUuidV4(folder_id)) {
    res.status(400).json({ message: "Invalid folder ID", success: false });
    return;
  }

  try {
    const access = await getFolderAccessForUserService(user_id, folder_id);
    const access_type: FolderAccessType = access.accessType;

    res.status(200).json({
      message: "Folder access type retrieved successfully",
      data: { access_type },
      success: true,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to retrieve folder access type";
    if (message === "Folder not found") {
      res.status(404).json({ message, success: false });
      return;
    }

    if (message === "Access denied") {
      res.status(403).json({ message, success: false });
      return;
    }

    console.error("Get folder access type failed:", error);
    res.status(500).json({ message: "Unable to retrieve folder access type", success: false });
  }
}

export default getFolderAccessTypeController;
