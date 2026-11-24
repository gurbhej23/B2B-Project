import { Router } from 'express';
import {
  calculateCart,
  checkout,
  listOrders,
  getOrderById,
  updateOrderStatus,
  recordOrderPayment,
  retryOrderNotification,
  updateOrderPaymentStatus,
  sendPaymentReminder,
} from './order.controller';
import { authenticate } from '../../middleware/authenticate';
import { requireRole } from '../../middleware/rbac';
import { validateBody } from '../../middleware/validate';
import { createOrderSchema } from '@necessity/shared';
import { UserRole } from '@necessity/shared';

const router = Router();

// Cart calculation (preview line items, taxes, totals)
router.post('/calculate-cart', authenticate, calculateCart);

// Place order with credit check & stock reservation
router.post(
  '/checkout',
  authenticate,
  validateBody(createOrderSchema),
  checkout
);

// List orders (scoped by role)
router.get('/', authenticate, listOrders);

// Order details (scoped by role)
router.get('/:id', authenticate, getOrderById);

// Update status (lifecycle transitions & cancellation)
router.patch(
  '/:id/status',
  authenticate,
  requireRole(
    UserRole.SUPER_ADMIN,
    UserRole.ADMIN,
    UserRole.SALES_MANAGER,
    UserRole.WAREHOUSE_MANAGER,
    UserRole.ACCOUNTS_MANAGER,
    UserRole.SALESMAN,
    UserRole.RETAILER
  ),
  updateOrderStatus
);

// Record offline payment (cash, UPI, NEFT/RTGS/IMPS, cheque)
router.post(
  '/:id/record-payment',
  authenticate,
  requireRole(
    UserRole.SUPER_ADMIN,
    UserRole.ADMIN,
    UserRole.ACCOUNTS_MANAGER
  ),
  recordOrderPayment
);

// Retry failed order email notification
router.post(
  '/:id/retry-notification',
  authenticate,
  requireRole(
    UserRole.SUPER_ADMIN,
    UserRole.ADMIN,
    UserRole.SALES_MANAGER,
    UserRole.ACCOUNTS_MANAGER,
    UserRole.WAREHOUSE_MANAGER
  ),
  retryOrderNotification
);

// Quick update payment status
router.patch(
  '/:id/payment-status',
  authenticate,
  requireRole(
    UserRole.SUPER_ADMIN,
    UserRole.ADMIN,
    UserRole.ACCOUNTS_MANAGER
  ),
  updateOrderPaymentStatus
);

// Send payment reminder (Email/WhatsApp/Push)
router.post(
  '/:id/send-payment-reminder',
  authenticate,
  sendPaymentReminder
);

export const orderRouter = router;
