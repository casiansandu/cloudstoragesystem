import express, { Router } from 'express';
import { getAllUsersController } from '../controllers/getAllUsersController';
import { getUserKeysController } from '../controllers/getUserKeysController';
import { authMiddleware } from '../middleware/authMiddleware';
import { getUserPublicKeyController } from '../controllers/getUserPublicKeyController';
import getAllUserFileKeysController from '../controllers/getAllUserFileKeys';
import { getUserPublicKeyBundleController } from '../controllers/getUserPublicKeyBundleController';
import { getUserEncryptedSeedController } from '../controllers/getUserEncryptedSeedController';

const router: Router = express.Router();

router.get('/keys/:username/public_keys_bundle', authMiddleware, getUserPublicKeyBundleController);
router.get('/keys/:username/public_key', authMiddleware, getUserPublicKeyController);
router.get('/keys/:username/encrypted_seed', authMiddleware, getUserEncryptedSeedController);
router.get('/all', authMiddleware, getAllUsersController);  
router.get('/keys', authMiddleware, getUserKeysController);
router.get('/file-keys', authMiddleware, getAllUserFileKeysController);


export default router;
