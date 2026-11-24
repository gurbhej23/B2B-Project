import { Router } from 'express';
import { analyticsController } from './analytics.controller';
import { authenticate } from '../../middleware/auth';
import { requireRole } from '../../middleware/rbac';
import { UserRole } from '@necessity/shared';

export const analyticsRouter = Router();

analyticsRouter.use(authenticate);

const ANALYTICS_ROLES = [
  UserRole.SUPER_ADMIN,
  UserRole.ADMIN,
  UserRole.ACCOUNTS_MANAGER,
  UserRole.SALES_MANAGER,
];

// Get analytics overview metrics & aggregations
analyticsRouter.get(
  '/overview',
  requireRole(...ANALYTICS_ROLES),
  analyticsController.getOverviewMetrics
);

// Download CSV report export
analyticsRouter.get(
  '/export',
  requireRole(...ANALYTICS_ROLES),
  analyticsController.exportCsvReport
);

