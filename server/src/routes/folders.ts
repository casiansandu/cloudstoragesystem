import express, { Router } from 'express';
import { createFolderController } from '../controllers/folders/createFolderController';
import { getRootFolderIdController } from '../controllers/folders/getRootFolderIdController';
import getFilesInfoByFolderController from '../controllers/files/getFilesInfoByFolderController';
import authMiddleware from '../middleware/authMiddleware';
import { getFoldersInfoByParentController } from '../controllers/folders/getFoldersInfoByParentController';
import { checkRootFolderExistsController } from '../controllers/folders/checkRootFolderExists';
import getFolderDataController from '../controllers/folders/getFolderDataController';



const router: Router = express.Router();

router.post('/create', authMiddleware, createFolderController);
router.get('/root/id', authMiddleware, getRootFolderIdController);
router.get('/root/exists', authMiddleware, checkRootFolderExistsController);

router.get('/:folderId/data', authMiddleware, getFolderDataController);
router.get('/:folderId/files', authMiddleware, getFilesInfoByFolderController);
router.get('/:folderId/folders', authMiddleware, getFoldersInfoByParentController);

export default router;