import express, { Router } from 'express';
import { createFolderController } from '../controllers/folders/createFolderController';
import { getRootFolderIdController } from '../controllers/folders/getRootFolderIdController';
import authMiddleware from '../middleware/authMiddleware';



const router: Router = express.Router();

router.post('/create', createFolderController);
router.get('/root/id', authMiddleware, getRootFolderIdController);

export default router;