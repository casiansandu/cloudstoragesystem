import express, { Router } from 'express';
import { createFolderController } from '../controllers/folders/createFolderController';
import { getRootFolderIdController } from '../controllers/folders/getRootFolderIdController';
import getFilesInfoByFolderController from '../controllers/files/getFilesInfoByFolderController';
import authMiddleware from '../middleware/authMiddleware';
import { getFoldersInfoByParentController } from '../controllers/folders/getFoldersInfoByParentController';
import { checkRootFolderExistsController } from '../controllers/folders/checkRootFolderExists';
import getFolderDataController from '../controllers/folders/getFolderDataController';
import hasAccessToFolderController from '../controllers/folders/hasAccessToFolderController';
import getFolderPermissionsController from '../controllers/folders/getFolderPermissionsController';
import { shareFolderHybridController } from '../controllers/folders/shareFolderHybridController';
import { getSharedFoldersController } from '../controllers/folders/getSharedFoldersController';
import { getFolderHybridInfoController } from '../controllers/folders/getFolderHybridInfoController';
import getFolderEncryptedKeyController from '../controllers/folders/getFolderEncryptedKeyController';
import getFolderAccessTypeController from '../controllers/folders/getFolderAccessTypeController';
import getSharedFilesInFolderController from '../controllers/files/getSharedFilesInFolderController';
import getSharedFoldersInFolderController from '../controllers/folders/getSharedFoldersInFolderController';
import getSharedFolderParentIdAndNameController from '../controllers/folders/getSharedFolderParentIdAndNameController';
import deleteFolderController from '../controllers/folders/deleteFolderController';



const router: Router = express.Router();

router.post('/create', authMiddleware, createFolderController);
router.post('/share', authMiddleware, shareFolderHybridController);
router.get('/root/id', authMiddleware, getRootFolderIdController);
router.get('/root/exists', authMiddleware, checkRootFolderExistsController);
router.get('/shared', authMiddleware, getSharedFoldersController);

router.get('/:folderId/data', authMiddleware, getFolderDataController);
router.get('/:folderId/encrypted_key', authMiddleware, getFolderEncryptedKeyController);
router.get('/:folderId/access_type', authMiddleware, getFolderAccessTypeController);
router.get('/:folderId/hybrid_info', authMiddleware, getFolderHybridInfoController);
router.get('/:folderId/permissions', authMiddleware, getFolderPermissionsController);
router.get('/hasaccess/:folderId', authMiddleware, hasAccessToFolderController);
router.get('/:folderId/files', authMiddleware, getFilesInfoByFolderController);
router.get('/:folderId/folders', authMiddleware, getFoldersInfoByParentController);
router.get('/:folderId/shared/files', authMiddleware, getSharedFilesInFolderController);
router.get('/:folderId/shared/folders', authMiddleware, getSharedFoldersInFolderController);
router.get('/:folderId/shared/parent', authMiddleware, getSharedFolderParentIdAndNameController);
router.delete('/:folderId', authMiddleware, deleteFolderController);

export default router;