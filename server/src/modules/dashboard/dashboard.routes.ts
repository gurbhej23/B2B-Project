import { Router } from 'express';
import { DashboardController } from './dashboard.controller';
import { authenticate } from '../../middleware/auth';
import { requireRole } from '../../middleware/rbac';
import { UserRole } from '@necessity/shared';

export const dashboardRouter = Router();

const DASHBOARD_STAFF_ROLES = [
  UserRole.SUPER_ADMIN,
  UserRole.ADMIN,
  UserRole.ACCOUNTS_MANAGER,
  UserRole.SALES_MANAGER,
  UserRole.WAREHOUSE_MANAGER,
];

dashboardRouter.use(authenticate);

dashboardRouter.get(
  '/overview',
  requireRole(...DASHBOARD_STAFF_ROLES),
  DashboardController.getOverview
);
