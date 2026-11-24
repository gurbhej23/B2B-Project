import { Router } from 'express';
import {
  getProducts,
  getProductById,
  createProduct,
  updateProduct,
  duplicateProduct,
  updateProductStatus,
  deleteProduct,
  bulkUpdateProductStatus,
  adjustStock,
  getStockOverview,
  getStockTransactions,
  importProducts,
  exportProducts,
  getCategories,
  createCategory,
  updateCategory,
  deleteCategory,
  getBrands,
  createBrand,
  updateBrand,
  deleteBrand,
  getZohoSyncOverview,
  syncProductToZoho,
  syncAllProductsToZoho,
  uploadProductImage,
  uploadProductVideo,
  deleteVariant,
  updateVariantStatus,
} from './product.controller';
import { authenticate } from '../../middleware/auth';
import { requireRole } from '../../middleware/rbac';
import { UserRole } from '@necessity/shared';

const router = Router();

const ADMIN_STAFF_ROLES = [
  UserRole.SUPER_ADMIN,
  UserRole.ADMIN,
  UserRole.WAREHOUSE_MANAGER,
  UserRole.ACCOUNTS_MANAGER,
];

// All routes require authentication
router.use(authenticate);

// 1. Categories
router.get('/categories', getCategories);
router.post('/categories', requireRole(UserRole.SUPER_ADMIN, UserRole.ADMIN), createCategory);
router.patch('/categories/:id', requireRole(UserRole.SUPER_ADMIN, UserRole.ADMIN), updateCategory);
router.delete('/categories/:id', requireRole(UserRole.SUPER_ADMIN, UserRole.ADMIN), deleteCategory);

// 2. Brands
router.get('/brands', getBrands);
router.post('/brands', requireRole(UserRole.SUPER_ADMIN, UserRole.ADMIN), createBrand);
router.patch('/brands/:id', requireRole(UserRole.SUPER_ADMIN, UserRole.ADMIN), updateBrand);
router.delete('/brands/:id', requireRole(UserRole.SUPER_ADMIN, UserRole.ADMIN), deleteBrand);

// 3. Stock Management
router.get('/stock/overview', requireRole(...ADMIN_STAFF_ROLES), getStockOverview);
router.get('/stock/history', requireRole(...ADMIN_STAFF_ROLES), getStockTransactions);

// 4. Import / Export
router.get('/export', requireRole(...ADMIN_STAFF_ROLES), exportProducts);
router.post('/import', requireRole(...ADMIN_STAFF_ROLES), importProducts);

// 5. Bulk status actions
router.post(
  '/bulk-status',
  requireRole(UserRole.SUPER_ADMIN, UserRole.ADMIN),
  bulkUpdateProductStatus
);

// 6. Zoho Inventory Sync
router.get('/zoho/status', requireRole(...ADMIN_STAFF_ROLES), getZohoSyncOverview);
router.post(
  '/zoho/sync-all',
  requireRole(UserRole.SUPER_ADMIN, UserRole.ADMIN),
  syncAllProductsToZoho
);
router.post(
  '/zoho/sync/:id',
  requireRole(UserRole.SUPER_ADMIN, UserRole.ADMIN),
  syncProductToZoho
);

// 7. Base product list, upload and details (must come after specific path prefixes)
router.post(
  '/upload-image',
  requireRole(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.WAREHOUSE_MANAGER),
  uploadProductImage
);

router.post(
  '/upload-video',
  requireRole(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.WAREHOUSE_MANAGER),
  uploadProductVideo
);

router.get('/', getProducts);
router.get('/:id', getProductById);

// 8. Product Variants
router.delete(
  '/:id/variants/:variantId',
  requireRole(UserRole.SUPER_ADMIN, UserRole.ADMIN),
  deleteVariant
);

router.patch(
  '/:id/variants/:variantId/status',
  requireRole(UserRole.SUPER_ADMIN, UserRole.ADMIN),
  updateVariantStatus
);

// 9. Product CRUD and Actions
router.post(
  '/',
  requireRole(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.WAREHOUSE_MANAGER),
  createProduct
);

router.post(
  '/:id/duplicate',
  requireRole(UserRole.SUPER_ADMIN, UserRole.ADMIN),
  duplicateProduct
);

router.patch(
  '/:id/status',
  requireRole(UserRole.SUPER_ADMIN, UserRole.ADMIN),
  updateProductStatus
);

router.patch(
  '/:id/stock',
  requireRole(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.WAREHOUSE_MANAGER),
  adjustStock
);

router.patch(
  '/:id',
  requireRole(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.WAREHOUSE_MANAGER),
  updateProduct
);

router.delete(
  '/:id',
  requireRole(UserRole.SUPER_ADMIN, UserRole.ADMIN),
  deleteProduct
);

export const productRouter = router;
