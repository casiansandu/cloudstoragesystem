import express, { Router } from 'express';

import { authMiddleware } from '../middleware/authMiddleware';
import { getAllUserFilesController } from '../controllers/getAllUserFilesController';
import { getUserKeysController } from '../controllers/getUserKeysController';
import { startUploadController } from '../controllers/startUploadController';
import { uploadController } from '../controllers/uploadController';
import getChunkController from '../controllers/getChunkController';

const router: Router = express.Router();
const rawParser = express.raw({ type: 'application/octet-stream', limit: '50mb' });

router.get('/all', authMiddleware, getAllUserFilesController);
router.post('/upload/start', authMiddleware, startUploadController);
router.post('/upload/chunk', authMiddleware, rawParser, uploadController);
router.get(`/chunk/:chunkId`, authMiddleware, getChunkController);
router.get('/keys', authMiddleware, getUserKeysController);



export default router;