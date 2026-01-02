import express, { Router } from 'express';
import { getAllUsersController } from '../controllers/getAllUsersController';
import { getUserKeysController } from '../controllers/getUserKeysController';
import { authMiddleware } from '../middleware/authMiddleware';
import { getUserPublicKeyController } from '../controllers/getUserPublicKeyController';

const router: Router = express.Router();

router.get('/keys/:username/public_key', authMiddleware, getUserPublicKeyController);
router.get('/all', authMiddleware, getAllUsersController);  
router.get('/keys', authMiddleware, getUserKeysController);

export default router;
