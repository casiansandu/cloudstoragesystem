import { Response } from "express";
import { ApiErrorResponse, ApiSuccessResponse, AuthenticatedRequest } from "../../types";
import { getFolderEncryptedKeyService } from "../../services/folders/getFolderEncryptedKeyService";
import { isUuidV4 } from "../../utils/validators";
import { getFolderAccessForUserService } from "../../services/folders/getFolderAccessForUserService";

export async function getFolderEncryptedKeyController(
  req: AuthenticatedRequest,
  res: Response<ApiSuccessResponse<{ encrypted_key_data: string }> | ApiErrorResponse>
): Promise<void> {
  const folder_id = req.params.folderId;
  const user_id = req.user?.id;

  if (!user_id || !folder_id) {
    res.status(400).json({
      message: "Missing required fields: user_id and folder_id are required.",
      success: false,
    });
    return;
  }

  if (!isUuidV4(folder_id)) {
    res.status(400).json({ message: "Invalid folder ID", success: false });
    return;
  }

  try {
    const access_type = (await getFolderAccessForUserService(user_id, folder_id)).accessType;
    const encrypted_key_data = await getFolderEncryptedKeyService(user_id, folder_id, access_type);
    res.status(200).json({
      message: "Folder encrypted key retrieved successfully",
      data: { encrypted_key_data },
      success: true,
    });
  } catch (error) {
    console.error("Get folder encrypted key failed:", error);
    res.status(500).json({
      message: "Unable to retrieve folder encrypted key",
      success: false,
    });
  }
}

export default getFolderEncryptedKeyController;
