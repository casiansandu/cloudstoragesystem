import express, { Router } from 'express';
import { getAllUsersController } from '../controllers/getAllUsersController';
import { getUserKeysController } from '../controllers/getUserKeysController';
import { authMiddleware } from '../middleware/authMiddleware';
import { getUserPublicKeyController } from '../controllers/getUserPublicKeyController';
import getAllUserFileKeysController from '../controllers/getAllUserFileKeys';

const router: Router = express.Router();

router.get('/keys/:username/public_key', authMiddleware, getUserPublicKeyController);
router.get('/all', authMiddleware, getAllUsersController);  
router.get('/keys', authMiddleware, getUserKeysController);
router.get('/file-keys', authMiddleware, getAllUserFileKeysController);


export default router;
