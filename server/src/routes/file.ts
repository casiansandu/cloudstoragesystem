import express, { Router } from 'express';

import { authMiddleware } from '../middleware/authMiddleware';
import { getAllUserFilesController } from '../controllers/storage/getAllUserFilesController';
import { uploadController } from '../controllers/storage/uploadController';
import getChunkController from '../controllers/storage/getChunkController';
import deleteFileController from '../controllers/storage/deleteFileDBController';
import isFileOwnerController from '../controllers/storage/checkOwnershipController';
import getFileMasterKeyController from '../controllers/storage/getFileMasterKeyController';
import hasAccessToFileController from '../controllers/storage/hasAccessToFileController';
import { startHybridUploadController } from '../controllers/storage/startUploadHybridController';
import { getHybridInfoController } from '../controllers/storage/getHybridUploadInfoController';
import { shareFileHybridController } from '../controllers/storage/shareFileHybridController';
import { getSharedUserFilesController } from '../controllers/storage/getSharedUserFilesController';

const router: Router = express.Router();
const rawParser = express.raw({ type: 'application/octet-stream', limit: '50mb' });

router.get('/all', authMiddleware, getAllUserFilesController);
router.get('/shared', authMiddleware, getSharedUserFilesController);
router.get('/hasaccess/:file_id', authMiddleware, hasAccessToFileController);
router.get('/isowner/:file_id', authMiddleware, isFileOwnerController);
router.get(`/download/:file_id/:chunk_id`, authMiddleware, getChunkController);
router.get(`/:file_id/key`, authMiddleware, getFileMasterKeyController);
router.get(`/:file_id/hybrid_info`, authMiddleware, getHybridInfoController);

router.post('/upload/start_hybrid', authMiddleware, startHybridUploadController);
router.post('/upload/:file_id/:chunk_id', authMiddleware, rawParser, uploadController);
router.post('/share_hybrid', authMiddleware, shareFileHybridController);

router.delete('/:file_id', authMiddleware, deleteFileController);

export default router;