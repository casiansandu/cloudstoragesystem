import { Response } from 'express';
import { ApiErrorResponse, ApiSuccessResponse, AuthenticatedRequest } from '../../types';
import { isUuidV4 } from '../../utils/validators';
import { getFolderAccessForUserService } from '../../services/folders/getFolderAccessForUserService';
import { deleteFolderService } from '../../services/folders/deleteFolderService';

export default async function deleteFolderController(
  req: AuthenticatedRequest,
  res: Response<ApiSuccessResponse<any> | ApiErrorResponse>
): Promise<void> {
  try {
    const userId = req.user?.id;
    const { folderId } = req.params;

    if (!userId) {
      res.status(401).json({ message: 'Unauthorized', success: false });
      return;
    }

    if (!folderId) {
      res.status(400).json({ message: 'Bad Request: folderId is required', success: false });
      return;
    }

    if (!isUuidV4(folderId)) {
      res.status(400).json({ message: 'Invalid folder ID', success: false });
      return;
    }

    const access = await getFolderAccessForUserService(userId, folderId);

    if (access.accessType !== 'owner' && !access.permissions.can_delete) {
      res.status(403).json({ message: 'Access denied, missing delete permission.', success: false });
      return;
    }

    await deleteFolderService(folderId);

    res.status(200).json({ message: 'Folder deleted successfully', success: true });

  } catch (error) {
    console.error('Delete folder failed:', error);
    
    const message = error instanceof Error ? error.message : 'Unable to delete folder';

    switch (message) {
      case 'Folder not found':
        res.status(404).json({ message, success: false });
        break;
      case 'Access denied':
        res.status(403).json({ message, success: false });
        break;
      case 'Root folder cannot be deleted':
        res.status(400).json({ message, success: false });
        break;
      default:
        res.status(500).json({ message: 'Unable to delete folder', success: false });
        break;
    }
  }
}