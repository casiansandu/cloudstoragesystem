import express, { Router } from 'express';
import { getAllUsersController } from '../controllers/getAllUsersController.js';

const router: Router = express.Router();

router.get('/all', getAllUsersController);

export default router;
