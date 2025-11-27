import express, { Router } from 'express';
import { registerController } from '../controllers/registerController.js';
import { loginController } from '../controllers/loginController.js';
import { logoutController } from '../controllers/logoutController.js';
import { verifyAuthMiddleware } from '../middleware/authMiddleware.js';
import { noAuthMiddleware } from '../middleware/noAuthMiddleware.js';
import { srpRegisterController } from '../controllers/srpRegisterController.js';

const router: Router = express.Router();

router.post('/register', noAuthMiddleware, registerController);
router.post('/srpregister', noAuthMiddleware, srpRegisterController);
router.post('/login', noAuthMiddleware, loginController);
router.post('/logout', verifyAuthMiddleware, logoutController);

export default router;
