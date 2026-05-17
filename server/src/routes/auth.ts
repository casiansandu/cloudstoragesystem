import express, { CookieOptions, Router } from 'express';
import { noAuthMiddleware } from '../middleware/noAuthMiddleware';
import { srpLoginStart, srpLoginVerify } from '../controllers/auth/srpLoginController';
import { checkLoginStatus } from '../controllers/auth/checkLoggedInController';
import srpRegisterController from '../controllers/auth/srpRegisterController';

const router: Router = express.Router();

router.post('/register', noAuthMiddleware, srpRegisterController);

router.post('/login/start', noAuthMiddleware, srpLoginStart);
router.post('/login/verify', noAuthMiddleware, srpLoginVerify);

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
