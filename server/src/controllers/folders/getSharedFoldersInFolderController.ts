import { Response } from "express";
import { ApiErrorResponse, ApiSuccessResponse, AuthenticatedRequest } from "../../types";
import { getSharedFoldersInFolderService } from "../../services/folders/getSharedFoldersInFolderService";
import { isUuidV4 } from "../../utils/validators";

export async function getSharedFoldersInFolderController(
  req: AuthenticatedRequest,
  res: Response<ApiSuccessResponse<{ folders: { id: string; encrypted_name_data: string; encrypted_key_data: string }[] }> | ApiErrorResponse>
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
    const folders = await getSharedFoldersInFolderService(user_id, folder_id);
    res.status(200).json({
      message: "Shared folders retrieved successfully",
      data: { folders },
      success: true,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to retrieve shared folders";
    if (message === "Folder not found") {
      res.status(404).json({ message, success: false });
      return;
    }

    if (message === "Access denied" || message === "Folder is not shared with the user") {
      res.status(403).json({ message, success: false });
      return;
    }

    console.error("Get shared folders by parent failed:", error);
    res.status(500).json({ message: "Unable to retrieve shared folders", success: false });
  }
}

export default getSharedFoldersInFolderController;
