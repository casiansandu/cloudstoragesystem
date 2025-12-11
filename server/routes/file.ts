import express, { Router } from 'express';

import { authMiddleware } from '../middleware/authMiddleware';
import { getAllUserFilesController } from '../controllers/getAllUserFilesController';
import { getUserKeysController } from '../controllers/getUserKeysController';
import { startUploadController } from '../controllers/uploadFileController';

const router: Router = express.Router();


router.get('/all', authMiddleware, getAllUserFilesController);
router.post('/upload/start', authMiddleware, startUploadController);
router.get('/keys', authMiddleware, getUserKeysController);



export default router;