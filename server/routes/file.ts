import express, { Router } from 'express';

import { authMiddleware } from '../middleware/authMiddleware';
import { getAllUserFilesController } from '../controllers/getAllUserFilesController';
import { uploadController } from '../controllers/uploadController';
import getChunkController from '../controllers/getChunkController';
import deleteFileController from '../controllers/deleteFileDBController';
import isFileOwnerController from '../controllers/checkOwnershipController';
import getFileMasterKeyController from '../controllers/getFileMasterKeyController';
import hasAccessToFileController from '../controllers/hasAccessToFileController';
import { startHybridUploadController } from '../controllers/startUploadHybridController';
import { getHybridInfoController } from '../controllers/getHybridUploadInfoController';
import { shareFileHybridController } from '../controllers/shareFileHybridController';

const router: Router = express.Router();
const rawParser = express.raw({ type: 'application/octet-stream', limit: '50mb' });

router.get('/all', authMiddleware, getAllUserFilesController);
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