import { getFolderAccessForUserService } from "./getFolderAccessForUserService";

export type FolderPermissions = {
  can_download: boolean;
  can_upload: boolean;
  can_share: boolean;
  can_delete: boolean;
};

export async function getFolderPermissionsService(
  userId: string,
  folderId: string
): Promise<FolderPermissions | null> {
  try {
    const access = await getFolderAccessForUserService(userId, folderId);
    if (access.accessType === "owner") {
      return {
        can_download: true,
        can_upload: true,
        can_share: true,
        can_delete: true,
      };
    }

    return {
      can_download: access.permissions.can_download,
      can_upload: access.permissions.can_upload,
      can_share: access.permissions.can_share,
      can_delete: access.permissions.can_delete,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message === "Access denied") {
      return null;
    }

    throw error;
  }
}
