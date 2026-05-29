import { Response } from "express";
import { ApiErrorResponse, ApiSuccessResponse, AuthenticatedRequest } from "../../types";
import { shareFolderHybridService } from "../../services/folders/shareFolderHybridService";
import { getFolderAccessForUserService } from "../../services/folders/getFolderAccessForUserService";
import { getIdByUsername } from "../../services/users/getIdByUsername";

type FolderShareResult = {
  folder_access_id: string;
};

export async function shareFolderHybridController(
  req: AuthenticatedRequest,
  res: Response<ApiSuccessResponse<FolderShareResult> | ApiErrorResponse>
): Promise<void> {
  const user = req.user;

  if (!user) {
    res.status(401).json({ message: "Unauthorized", success: false });
    return;
  }

  const {
    folder_id,
    recipient_username,
    encrypted_folder_key,
    share_duration,
    mlkem_ciphertext,
    x25519_ephemeral_public,
    permissions,
  } = req.body;

  if (
    !folder_id ||
    !recipient_username ||
    !encrypted_folder_key ||
    share_duration === undefined ||
    share_duration === null ||
    !mlkem_ciphertext ||
    !x25519_ephemeral_public ||
    !permissions
  ) {
    res.status(400).json({ message: "Missing required fields", success: false });
    return;
  }

  try {
    const recipient_id = await getIdByUsername(recipient_username);
    if (!recipient_id) {
      res.status(404).json({ message: "Recipient user not found", success: false });
      return;
    }
    const access = await getFolderAccessForUserService(user.id, folder_id);
    if (access.accessType !== "owner" && !access.permissions.can_share) {
      res.status(403).json({ message: "Access denied", success: false });
      return;
    }

    const access_id = await shareFolderHybridService(
      user.id,
      folder_id,
      recipient_id,
      encrypted_folder_key,
      share_duration,
      mlkem_ciphertext,
      x25519_ephemeral_public,
      permissions
    );
    console.log("Folder shared with access ID:", access_id);
    res.status(200).json({
      message: "Folder shared successfully",
      data: { folder_access_id: access_id },
      success: true,
    });
  } catch (error) {
    console.error("Share folder failed:", error);
    res.status(500).json({ message: "Unable to share folder", success: false });
  }
}
