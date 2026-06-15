import express, { Router } from 'express';
import { getUserKeysController } from '../controllers/users/keys/getUserKeysController';
import { authMiddleware } from '../middleware/authMiddleware';
import { getAllUserFileKeysController } from '../controllers/users/keys/getAllUserFileKeys';
import { getUserPublicKeyBundleController } from '../controllers/users/keys/getUserPublicKeysController';
import { getUserEncryptedSeedController } from '../controllers/users/keys/getUserEncryptedSeedController';
import { getUserEncryptedArkController } from '../controllers/users/keys/getUserEncryptedArkController';
import { getUserIdController } from '../controllers/users/info/getUserIdController';
const router: Router = express.Router();

router.get('/:username/id', authMiddleware, getUserIdController);
router.get('/keys/:user_id/public_keys_bundle', authMiddleware, getUserPublicKeyBundleController);
router.get('/keys/encrypted_seed', authMiddleware, getUserEncryptedSeedController);
router.get('/keys/encrypted_ark', authMiddleware, getUserEncryptedArkController);
router.get('/keys', authMiddleware, getUserKeysController);
router.get('/file-keys', authMiddleware, getAllUserFileKeysController);

export default router;
