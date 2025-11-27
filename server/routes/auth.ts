import express, { Router } from 'express';
import { registerController } from '../controllers/registerController';
import { loginController } from '../controllers/loginController';
import { logoutController } from '../controllers/logoutController';
import { verifyAuthMiddleware } from '../middleware/authMiddleware';
import { noAuthMiddleware } from '../middleware/noAuthMiddleware';

const router: Router = express.Router();

router.post('/register', noAuthMiddleware, registerController);
router.post('/login', noAuthMiddleware, loginController);
router.post('/logout', verifyAuthMiddleware, logoutController);

export default router;
