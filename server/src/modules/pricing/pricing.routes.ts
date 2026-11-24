import { Router } from 'express';
import { PricingController } from './pricing.controller';
import { authenticate } from '../../middleware/authenticate';
import { requireRole } from '../../middleware/rbac';
import { UserRole } from '@necessity/shared';

const router = Router();

// Pricing Groups
router.get('/groups', authenticate, PricingController.getGroups);
router.get('/groups/:id', authenticate, PricingController.getGroupById);
router.post(
  '/groups',
  authenticate,
  requireRole(UserRole.SUPER_ADMIN, UserRole.ADMIN),
  PricingController.createGroup
);
router.patch(
  '/groups/:id',
  authenticate,
  requireRole(UserRole.SUPER_ADMIN, UserRole.ADMIN),
  PricingController.updateGroup
);
router.delete(
  '/groups/:id',
  authenticate,
  requireRole(UserRole.SUPER_ADMIN, UserRole.ADMIN),
  PricingController.deleteGroup
);

// Pricing Rules
router.get(
  '/rules',
  authenticate,
  requireRole(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.SALES_MANAGER, UserRole.ACCOUNTS_MANAGER),
  PricingController.getRules
);
router.get(
  '/rules/:id',
  authenticate,
  requireRole(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.SALES_MANAGER, UserRole.ACCOUNTS_MANAGER),
  PricingController.getRuleById
);
router.post(
  '/rules',
  authenticate,
  requireRole(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.SALES_MANAGER),
  PricingController.createRule
);
router.patch(
  '/rules/:id',
  authenticate,
  requireRole(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.SALES_MANAGER),
  PricingController.updateRule
);
router.delete(
  '/rules/:id',
  authenticate,
  requireRole(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.SALES_MANAGER),
  PricingController.deleteRule
);

// Price calculation & resolution endpoint
router.post('/calculate', authenticate, PricingController.calculatePrice);

export default router;

