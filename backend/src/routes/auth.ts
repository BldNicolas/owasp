import { Router } from 'express';
import authMiddleware from '@/middlewares/auth';
import { login, logout, me, register } from '@/controllers/auth';

const router = Router();

router.post('/register', register);
router.post('/login', login);
router.post('/logout', authMiddleware, logout);
router.get('/me', authMiddleware, me);


export default router;
