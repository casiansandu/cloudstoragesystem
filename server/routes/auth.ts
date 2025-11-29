import express, { Router } from 'express';
import { logoutController } from '../controllers/logoutController';
import { verifyAuthMiddleware } from '../middleware/authMiddleware';
import { noAuthMiddleware } from '../middleware/noAuthMiddleware';
import { srpLoginStart, srpLoginVerify } from '../controllers/srpLoginController';
import { checkLoginStatus } from '../controllers/checkLoggedIn';
import srpRegisterController from '../controllers/srpRegisterController';

const router: Router = express.Router();

router.post('/register', noAuthMiddleware, srpRegisterController);

router.post('/login/start', noAuthMiddleware, srpLoginStart);
router.post('/login/verify', noAuthMiddleware, srpLoginVerify);

router.post('/logout', verifyAuthMiddleware, logoutController);
router.get('/status', checkLoginStatus)

export default router;
