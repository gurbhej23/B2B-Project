import { Router } from 'express';
import { PaymentController } from './payment.controller';
import { authenticate } from '../../middleware/auth';
import { requireRole } from '../../middleware/rbac';
import { UserRole } from '@necessity/shared';

export const paymentRouter = Router();

const FINANCE_ROLES = [
  UserRole.SUPER_ADMIN,
  UserRole.ADMIN,
  UserRole.ACCOUNTS_MANAGER,
];

// Webhook endpoint (unauthenticated, secured via HMAC signature verification)
paymentRouter.post('/webhook', PaymentController.webhook);

// Authenticated payment operations
paymentRouter.use(authenticate);

paymentRouter.post('/intent', PaymentController.createIntent);
paymentRouter.post('/verify', PaymentController.verify);
paymentRouter.post('/bank-transfer', PaymentController.recordBankTransfer);

// Admin Finance verification endpoints
paymentRouter.get('/pending', requireRole(...FINANCE_ROLES), PaymentController.getPending);
paymentRouter.patch('/:id/verify', requireRole(...FINANCE_ROLES), PaymentController.verifyPayment);
paymentRouter.patch('/:id/reject', requireRole(...FINANCE_ROLES), PaymentController.rejectPayment);
