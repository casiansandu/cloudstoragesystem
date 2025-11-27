import express, { Router } from 'express';
import { createDirController } from '../controllers/createDirController';
import { verifyAuthMiddleware } from '../middleware/authMiddleware';
import { checkFolderExists } from '../middleware/checkFolderExistsMW';

const router: Router = express.Router();

router.post('/create', verifyAuthMiddleware, checkFolderExists, createDirController);

export default router;
