import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { AuthController } from './auth.controller';
import { authenticate } from '../../middleware/auth';
import { requireRole } from '../../middleware/rbac';
import { validateBody } from '../../middleware/validate';
import { loginSchema, createStaffSchema, UserRole } from '@necessity/shared';

export const authRouter = Router();

// Throttling for sensitive auth routes
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: process.env.NODE_ENV === 'production' ? 15 : 1000,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: {
      code: 'TOO_MANY_REQUESTS',
      message: 'Too many login attempts from this IP address. Please try again in 15 minutes.',
    },
  },
});

const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: {
      code: 'TOO_MANY_REQUESTS',
      message: 'Registration rate limit exceeded. Please try again later.',
    },
  },
});

authRouter.post('/register', registerLimiter, AuthController.register);
authRouter.post('/login', loginLimiter, validateBody(loginSchema), AuthController.login);
authRouter.get('/check-status', AuthController.checkStatus);
authRouter.post('/check-status', AuthController.checkStatus);
authRouter.post('/refresh', AuthController.refreshToken);
authRouter.post('/refresh-token', AuthController.refreshToken);
authRouter.post('/logout', authenticate, AuthController.logout);
authRouter.get('/me', authenticate, AuthController.me);
authRouter.patch('/profile', authenticate, AuthController.updateProfile);
authRouter.post('/change-password', authenticate, AuthController.changePassword);

// Super Admin staff provisioning workflow
authRouter.post(
  '/staff',
  authenticate,
  requireRole(UserRole.SUPER_ADMIN),
  validateBody(createStaffSchema),
  AuthController.createStaff
);

