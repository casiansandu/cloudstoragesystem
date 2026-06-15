import express, { Router } from 'express';

import { authMiddleware } from '../middleware/authMiddleware';
import { getAllUserFilesController } from '../controllers/files/info/getAllUserFilesController';
import { uploadController } from '../controllers/files/transfer/uploadController';
import getChunkController from '../controllers/files/transfer/getChunkController';
import deleteFileController from '../controllers/files/manage/deleteFileDBController';
import isFileOwnerController from '../controllers/files/access/checkOwnershipController';
import getFileMasterKeyController from '../controllers/files/keys/getFileMasterKeyController';
import hasAccessToFileController from '../controllers/files/access/hasAccessToFileController';
import { startHybridUploadController } from '../controllers/files/transfer/startUploadHybridController';
import { getHybridInfoController } from '../controllers/files/transfer/getHybridUploadInfoController';
import { shareFileHybridController } from '../controllers/files/share/shareFileHybridController';
import { getSharedUserFilesController } from '../controllers/files/share/getSharedUserFilesController';
import getOwnerIdByFileIdController from '../controllers/files/info/getOwnerIdByFileIdController';
import getSharingUserIdFromAccessController from '../controllers/files/share/getSharingUserIdFromAccessController';
import getSignatureForFileController from '../controllers/files/share/getSignatureForFileController';

const router: Router = express.Router();
const rawParser = express.raw({ type: 'application/octet-stream', limit: '50mb' });

router.get('/all', authMiddleware, getAllUserFilesController);
router.get('/shared', authMiddleware, getSharedUserFilesController);
router.get('/hasaccess/:file_id', authMiddleware, hasAccessToFileController);
router.get('/isowner/:file_id', authMiddleware, isFileOwnerController);
router.get(`/download/:file_id/:chunk_id`, authMiddleware, getChunkController);
router.get(`/:file_id/key`, authMiddleware, getFileMasterKeyController);
router.get(`/:file_id/hybrid_info`, authMiddleware, getHybridInfoController);
router.get(`/:file_id/owner_id`, authMiddleware, getOwnerIdByFileIdController);
router.get(`/:file_id/sharing_user_id`, authMiddleware, getSharingUserIdFromAccessController);
router.get(`/:file_id/signature`, authMiddleware, getSignatureForFileController);

router.post('/upload/start_hybrid', authMiddleware, startHybridUploadController);
router.post('/upload/:file_id/:chunk_id', authMiddleware, rawParser, uploadController);
router.post('/share_hybrid', authMiddleware, shareFileHybridController);

router.delete('/:file_id', authMiddleware, deleteFileController);

export default router;