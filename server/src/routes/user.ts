import express, { Router } from 'express';
import { getUserKeysController } from '../controllers/users/keys/getUserKeysController';
import { authMiddleware } from '../middleware/authMiddleware';
import { getUserPublicKeyController } from '../controllers/users/keys/getUserPublicKeyController';
import { getAllUserFileKeysController } from '../controllers/users/keys/getAllUserFileKeys';
import { getUserPublicKeyBundleController } from '../controllers/users/keys/getUserPublicKeyBundleController';
import { getUserEncryptedSeedController } from '../controllers/users/keys/getUserEncryptedSeedController';
import { getUserEncryptedArkController } from '../controllers/users/keys/getUserEncryptedArkController';

const router: Router = express.Router();

router.get('/keys/:username/public_keys_bundle', authMiddleware, getUserPublicKeyBundleController);
router.get('/keys/:username/public_key', authMiddleware, getUserPublicKeyController);
router.get('/keys/encrypted_seed', authMiddleware, getUserEncryptedSeedController);
router.get('/keys/encrypted_ark', authMiddleware, getUserEncryptedArkController);
router.get('/keys', authMiddleware, getUserKeysController);
router.get('/file-keys', authMiddleware, getAllUserFileKeysController);

export default router;
