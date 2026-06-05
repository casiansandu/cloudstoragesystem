import express, { CookieOptions, Router } from 'express';
import { noAuthMiddleware } from '../middleware/noAuthMiddleware';
import { checkLoginStatus } from '../controllers/auth/access/checkLoggedInController';
import srpRegisterController from '../controllers/auth/register/srpRegisterController';
import { opaqueRegisterFinish, opaqueRegisterInit } from '../controllers/auth/register/opaqueRegisterController';
import { opaqueLoginStart, opaqueLoginVerify } from '../controllers/auth/login/opaqueLoginController';

const router: Router = express.Router();

router.post('/register/opq/init', noAuthMiddleware, opaqueRegisterInit);
router.post('/register/opq/finish', noAuthMiddleware, opaqueRegisterFinish);
router.post('/register', noAuthMiddleware, srpRegisterController);

router.post('/login/start', noAuthMiddleware, opaqueLoginStart);
router.post('/login/verify', noAuthMiddleware, opaqueLoginVerify);

router.get('/status', checkLoginStatus)

router.post('/logout', (_req, res) => {
    
    const cookieOptions: CookieOptions= {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        path: '/'
    };

    // This sends the "Set-Cookie" header with an expired date
    res.clearCookie('token', cookieOptions);

    return res.status(200).json({ message: 'Logged out successfully' });
});

export default router;
