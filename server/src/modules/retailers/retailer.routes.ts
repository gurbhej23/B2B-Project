import { Router } from 'express';
import { RetailerController } from './retailer.controller';
import { authenticate } from '../../middleware/auth';
import { requireRole } from '../../middleware/rbac';
import { validateBody } from '../../middleware/validate';
import {
  UserRole,
  retailerApprovalSchema,
  updateCustomerTypeSchema,
  updateCustomerStatusSchema,
} from '@necessity/shared';

export const retailerRouter = Router();

// All customer/retailer management routes require authentication
retailerRouter.use(authenticate);

const adminStaffRoles = [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.ACCOUNTS_MANAGER];

// List pending retailers for approval (Admin / Super Admin / Accounts)
retailerRouter.get('/pending', requireRole(...adminStaffRoles), RetailerController.getPending);

// List all retailers (Admin, Accounts, Sales Manager, Salesman scoped)
retailerRouter.get(
  '/',
  requireRole(
    UserRole.SUPER_ADMIN,
    UserRole.ADMIN,
    UserRole.ACCOUNTS_MANAGER,
    UserRole.SALES_MANAGER,
    UserRole.SALESMAN
  ),
  RetailerController.list
);

// Customer self-service: update delivery & billing addresses
retailerRouter.patch('/my-addresses', RetailerController.updateMyAddresses);

// Get single retailer/customer profile
retailerRouter.get('/:id', RetailerController.getById);

// Approve / Reject / Suspend retailer with full credit configuration (Standard workflow)
retailerRouter.patch(
  '/:id/approval',
  requireRole(...adminStaffRoles),
  validateBody(retailerApprovalSchema),
  RetailerController.updateApproval
);

// Direct Approve customer endpoint
retailerRouter.patch('/:id/approve', requireRole(...adminStaffRoles), RetailerController.approve);

// Direct Reject customer endpoint
retailerRouter.patch('/:id/reject', requireRole(...adminStaffRoles), RetailerController.reject);

// Update Customer Type (New / Old)
retailerRouter.patch(
  '/:id/type',
  requireRole(...adminStaffRoles),
  validateBody(updateCustomerTypeSchema),
  RetailerController.updateType
);

// Enable or Disable Customer Account
retailerRouter.patch(
  '/:id/status',
  requireRole(...adminStaffRoles),
  validateBody(updateCustomerStatusSchema),
  RetailerController.updateStatus
);

// Delete or Archive Customer Account (Safely archives if order/invoice history exists)
retailerRouter.delete(
  '/:id',
  requireRole(UserRole.SUPER_ADMIN, UserRole.ADMIN),
  RetailerController.deleteCustomer
);
