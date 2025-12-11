import express, { CookieOptions, Router } from 'express';
import { noAuthMiddleware } from '../middleware/noAuthMiddleware';
import { srpLoginStart, srpLoginVerify } from '../controllers/srpLoginController';
import { checkLoginStatus } from '../controllers/checkLoggedIn';
import srpRegisterController from '../controllers/srpRegisterController';

const router: Router = express.Router();

router.post('/register', noAuthMiddleware, srpRegisterController);

router.post('/login/start', noAuthMiddleware, srpLoginStart);
router.post('/login/verify', noAuthMiddleware, srpLoginVerify);

router.get('/status', checkLoginStatus)

router.post('/logout', (req, res) => {
    
    // The options here MUST match the options used when creating the cookie.
    const cookieOptions: CookieOptions= {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production', // true for https
        sameSite: 'strict',
        path: '/'
    };

    // This sends the "Set-Cookie" header with an expired date
    res.clearCookie('token', cookieOptions);

    return res.status(200).json({ message: 'Logged out successfully' });
});

export default router;
