import { Router } from 'express';
import { creditController } from './credit.controller';
import { authenticate } from '../../middleware/auth';
import { requireRole } from '../../middleware/rbac';
import { UserRole } from '@necessity/shared';

export const creditRouter = Router();

creditRouter.use(authenticate);

const STAFF_ROLES = [
  UserRole.SUPER_ADMIN,
  UserRole.ADMIN,
  UserRole.ACCOUNTS_MANAGER,
];

// High-level credit portfolio overview
creditRouter.get(
  '/overview',
  requireRole(...STAFF_ROLES),
  creditController.getCreditOverview
);

// Customer-wise ledger statement (accessible by staff and the retailer themselves)
creditRouter.get(
  '/ledger',
  requireRole(...STAFF_ROLES, UserRole.RETAILER),
  creditController.getLedger
);

// Record payment (creates PaymentTransaction + LedgerEntry + decrements receivables)
creditRouter.post(
  '/payment',
  requireRole(...STAFF_ROLES),
  creditController.recordPayment
);

// Record debit/credit adjustment (Credit Note / Debit Adjustment)
creditRouter.post(
  '/adjust',
  requireRole(...STAFF_ROLES),
  creditController.recordAdjustment
);

// Update credit terms (Limit, Payment terms days, On-Hold status)
creditRouter.patch(
  '/terms/:retailerId',
  requireRole(...STAFF_ROLES),
  creditController.updateCreditTerms
);
