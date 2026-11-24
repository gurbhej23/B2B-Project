import { Router } from 'express';
import { zohoService } from './zoho.service';
import { authenticate } from '../../../middleware/auth';
import { requireRole } from '../../../middleware/rbac';
import { UserRole } from '@necessity/shared';
import { sendSuccess } from '../../../utils/response';

export const zohoRouter = Router();

zohoRouter.use(authenticate);

const STAFF_ROLES = [
  UserRole.SUPER_ADMIN,
  UserRole.ADMIN,
  UserRole.ACCOUNTS_MANAGER,
];

// Check Zoho Books live connectivity and credentials status
zohoRouter.get(
  '/status',
  requireRole(...STAFF_ROLES),
  async (_req, res, next) => {
    try {
      const status = zohoService.getSyncStatus();
      sendSuccess(res, status, 'Zoho integration status retrieved');
    } catch (err) {
      next(err);
    }
  }
);

// Manually trigger Retailer sync to Zoho Books
zohoRouter.post(
  '/sync-customer/:retailerId',
  requireRole(...STAFF_ROLES),
  async (req, res, next) => {
    try {
      const result = await zohoService.syncRetailerCustomer(req.params.retailerId);
      sendSuccess(res, result, 'Customer synced to Zoho Books successfully');
    } catch (err) {
      next(err);
    }
  }
);

// Manually trigger Invoice sync to Zoho Books
zohoRouter.post(
  '/sync-invoice/:invoiceId',
  requireRole(...STAFF_ROLES),
  async (req, res, next) => {
    try {
      const result = await zohoService.syncInvoice(req.params.invoiceId);
      sendSuccess(res, result, 'Invoice synced to Zoho Books successfully');
    } catch (err) {
      next(err);
    }
  }
);
