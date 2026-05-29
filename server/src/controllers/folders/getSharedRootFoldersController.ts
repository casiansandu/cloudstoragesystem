import { Response } from "express";
import { ApiErrorResponse, ApiSuccessResponse, AuthenticatedRequest } from "../../types";
import { getSharedRootFoldersService } from "../../services/folders/getSharedRootFoldersService";

export async function getSharedRootFoldersController(
  req: AuthenticatedRequest,
  res: Response<ApiSuccessResponse<{ folders: { id: string; encrypted_name_data: string; encrypted_access_key_data: string }[] }> | ApiErrorResponse>
): Promise<void> {
  const user_id = req.user?.id;
  if (!user_id) {
    res.status(401).json({ message: "Unauthorized", success: false });
    return;
  }

  try {
    const folders = await getSharedRootFoldersService(user_id);
    res.status(200).json({
      message: "Shared folders retrieved successfully",
      data: { folders },
      success: true,
    });
  } catch (error) {
    console.error("Get shared folders failed:", error);
    res.status(500).json({ message: "Unable to retrieve shared folders", success: false });
  }
}
