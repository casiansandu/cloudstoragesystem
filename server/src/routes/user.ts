import express, { Router } from 'express';
import { getAllUsersController } from '../controllers/users/getAllUsersController';
import { getUserKeysController } from '../controllers/users/getUserKeysController';
import { authMiddleware } from '../middleware/authMiddleware';
import { getUserPublicKeyController } from '../controllers/users/getUserPublicKeyController';
import { getAllUserFileKeysController } from '../controllers/users/getAllUserFileKeys';
import { getUserPublicKeyBundleController } from '../controllers/users/getUserPublicKeyBundleController';
import { getUserEncryptedSeedController } from '../controllers/users/getUserEncryptedSeedController';
import { getUserEncryptedArkController } from '../controllers/users/getUserEncryptedArkController';

const router: Router = express.Router();

router.get('/keys/:username/public_keys_bundle', authMiddleware, getUserPublicKeyBundleController);
router.get('/keys/:username/public_key', authMiddleware, getUserPublicKeyController);
router.get('/keys/:username/encrypted_seed', authMiddleware, getUserEncryptedSeedController);
router.get('/keys/:username/encrypted_ark', authMiddleware, getUserEncryptedArkController);
router.get('/all', authMiddleware, getAllUsersController);  
router.get('/keys', authMiddleware, getUserKeysController);
router.get('/file-keys', authMiddleware, getAllUserFileKeysController);

export default router;
