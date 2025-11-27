import express, { Router } from 'express';
import { createDirController } from '../controllers/createDirController.js';
import { verifyAuthMiddleware } from '../middleware/authMiddleware.js';
import { checkFolderExists } from '../middleware/checkFolderExistsMW.js';

const router: Router = express.Router();

router.post('/create', verifyAuthMiddleware, checkFolderExists, createDirController);

export default router;
