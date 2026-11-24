import { Router } from 'express';
import {
  listProductDiscounts,
  getProductDiscountById,
  createProductDiscount,
  updateProductDiscount,
  toggleProductDiscountStatus,
  deleteProductDiscount,
  listCoupons,
  getCouponById,
  createCoupon,
  updateCoupon,
  toggleCouponStatus,
  deleteCoupon,
  listCouponRedemptions,
  listAllRedemptions,
  validateCouponCode,
  listDiscountGroups,
  getDiscountGroupById,
  createDiscountGroup,
  updateDiscountGroup,
  deleteDiscountGroup,
} from './discount.controller';
import { authenticate } from '../../middleware/authenticate';
import { requireRole } from '../../middleware/rbac';
import { validateBody } from '../../middleware/validate';
import {
  createProductDiscountSchema,
  createCouponSchema,
  UserRole,
} from '@necessity/shared';

const router = Router();

// =========================================================================
// CUSTOMER ENDPOINTS (Retailer & Staff)
// =========================================================================

// Customer coupon validation
router.post('/coupons/validate', authenticate, validateCouponCode);

// =========================================================================
// ADMIN PRODUCT DISCOUNTS
// =========================================================================

router.get(
  '/products',
  authenticate,
  requireRole(
    UserRole.SUPER_ADMIN,
    UserRole.ADMIN,
    UserRole.SALES_MANAGER,
    UserRole.ACCOUNTS_MANAGER
  ),
  listProductDiscounts
);

router.post(
  '/products',
  authenticate,
  requireRole(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.SALES_MANAGER),
  validateBody(createProductDiscountSchema),
  createProductDiscount
);

router.get(
  '/products/:id',
  authenticate,
  requireRole(
    UserRole.SUPER_ADMIN,
    UserRole.ADMIN,
    UserRole.SALES_MANAGER,
    UserRole.ACCOUNTS_MANAGER
  ),
  getProductDiscountById
);

router.put(
  '/products/:id',
  authenticate,
  requireRole(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.SALES_MANAGER),
  updateProductDiscount
);

router.patch(
  '/products/:id/status',
  authenticate,
  requireRole(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.SALES_MANAGER),
  toggleProductDiscountStatus
);

router.delete(
  '/products/:id',
  authenticate,
  requireRole(UserRole.SUPER_ADMIN, UserRole.ADMIN),
  deleteProductDiscount
);

// =========================================================================
// ADMIN ORDER COUPONS
// =========================================================================

router.get(
  '/coupons',
  authenticate,
  requireRole(
    UserRole.SUPER_ADMIN,
    UserRole.ADMIN,
    UserRole.SALES_MANAGER,
    UserRole.ACCOUNTS_MANAGER
  ),
  listCoupons
);

router.post(
  '/coupons',
  authenticate,
  requireRole(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.SALES_MANAGER),
  validateBody(createCouponSchema),
  createCoupon
);

router.get(
  '/coupons/:id',
  authenticate,
  requireRole(
    UserRole.SUPER_ADMIN,
    UserRole.ADMIN,
    UserRole.SALES_MANAGER,
    UserRole.ACCOUNTS_MANAGER
  ),
  getCouponById
);

router.put(
  '/coupons/:id',
  authenticate,
  requireRole(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.SALES_MANAGER),
  updateCoupon
);

router.patch(
  '/coupons/:id/status',
  authenticate,
  requireRole(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.SALES_MANAGER),
  toggleCouponStatus
);

router.delete(
  '/coupons/:id',
  authenticate,
  requireRole(UserRole.SUPER_ADMIN, UserRole.ADMIN),
  deleteCoupon
);

router.get(
  '/coupons/:id/redemptions',
  authenticate,
  requireRole(
    UserRole.SUPER_ADMIN,
    UserRole.ADMIN,
    UserRole.SALES_MANAGER,
    UserRole.ACCOUNTS_MANAGER
  ),
  listCouponRedemptions
);

router.get(
  '/redemptions',
  authenticate,
  requireRole(
    UserRole.SUPER_ADMIN,
    UserRole.ADMIN,
    UserRole.SALES_MANAGER,
    UserRole.ACCOUNTS_MANAGER
  ),
  listAllRedemptions
);

// =========================================================================
// DISCOUNT GROUPS
// =========================================================================

router.get('/groups', authenticate, listDiscountGroups);
router.get('/groups/:id', authenticate, getDiscountGroupById);
router.post(
  '/groups',
  authenticate,
  requireRole(UserRole.SUPER_ADMIN, UserRole.ADMIN),
  createDiscountGroup
);
router.patch(
  '/groups/:id',
  authenticate,
  requireRole(UserRole.SUPER_ADMIN, UserRole.ADMIN),
  updateDiscountGroup
);
router.delete(
  '/groups/:id',
  authenticate,
  requireRole(UserRole.SUPER_ADMIN, UserRole.ADMIN),
  deleteDiscountGroup
);

export const discountRouter = router;
