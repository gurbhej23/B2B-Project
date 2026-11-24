import { Router } from 'express';
import { invoiceController } from './invoice.controller';
import { authenticate } from '../../middleware/auth';
import { requireRole } from '../../middleware/rbac';
import { UserRole } from '@necessity/shared';

export const invoiceRouter = Router();

invoiceRouter.use(authenticate);

const STAFF_ROLES = [
  UserRole.SUPER_ADMIN,
  UserRole.ADMIN,
  UserRole.ACCOUNTS_MANAGER,
  UserRole.WAREHOUSE_MANAGER,
  UserRole.SALES_MANAGER,
];

// List invoices (retailer only sees their own; staff sees all)
invoiceRouter.get(
  '/',
  requireRole(...STAFF_ROLES, UserRole.RETAILER),
  invoiceController.listInvoices
);

// View single invoice details
invoiceRouter.get(
  '/:id',
  requireRole(...STAFF_ROLES, UserRole.RETAILER),
  invoiceController.getInvoiceById
);

// Stream / download PDF for invoice
invoiceRouter.get(
  '/:id/pdf',
  requireRole(...STAFF_ROLES, UserRole.RETAILER),
  invoiceController.downloadPdf
);

// Generate invoice from an existing Order
invoiceRouter.post(
  '/generate-from-order/:orderId',
  requireRole(...STAFF_ROLES),
  invoiceController.generateFromOrder
);

// Record payment against an invoice (supports offline payments, partial & full)
invoiceRouter.post(
  '/:id/payments',
  requireRole(...STAFF_ROLES),
  invoiceController.recordPayment
);

// Formally issue a Draft / Proforma invoice as final Tax Invoice
invoiceRouter.post(
  '/:id/issue',
  requireRole(...STAFF_ROLES),
  invoiceController.issueTaxInvoice
);

// Trigger Zoho Books sync for a specific invoice
invoiceRouter.post(
  '/:id/sync-zoho',
  requireRole(...STAFF_ROLES),
  invoiceController.syncInvoiceToZoho
);
