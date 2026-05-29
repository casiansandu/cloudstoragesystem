import { Response } from "express";
import { ApiErrorResponse, ApiSuccessResponse, AuthenticatedRequest } from "../../types";
import { getFolderHybridInfoService } from "../../services/folders/getFolderHybridInfoService";
import { isUuidV4 } from "../../utils/validators";

export async function getFolderHybridInfoController(
  req: AuthenticatedRequest,
  res: Response<ApiSuccessResponse<{ x25519_ephemeral_public: string; mlkem_ciphertext: string }> | ApiErrorResponse>
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
    const info = await getFolderHybridInfoService(folder_id, user_id);
    res.status(200).json({
      message: "Folder hybrid info retrieved successfully",
      data: {
        x25519_ephemeral_public: info.x25519_ephemeral_public,
        mlkem_ciphertext: info.mlkem_ciphertext,
      },
      success: true,
    });
  } catch (error) {
    console.error("Get folder hybrid info failed:", error);
    res.status(500).json({ message: "Unable to retrieve folder hybrid info", success: false });
  }
}
