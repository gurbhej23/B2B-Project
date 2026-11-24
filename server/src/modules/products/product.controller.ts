import { Request, Response } from 'express';
import { productService } from './product.service';
import { asyncHandler } from '../../utils/async-handler';
import { ApiResponse } from '@necessity/shared';

export const getProducts = asyncHandler(async (req: Request, res: Response) => {
  const {
    search,
    categoryId,
    brand,
    status,
    stockFilter,
    inStockOnly,
    minPricePaise,
    maxPricePaise,
    page,
    limit,
    sortBy,
    sortOrder,
  } = req.query;

  const result = await productService.getProducts(
    {
      search: search as string,
      categoryId: categoryId as string,
      brand: brand as string,
      status: status as any,
      stockFilter: stockFilter as any,
      inStockOnly: inStockOnly === 'true',
      minPricePaise: minPricePaise ? parseInt(minPricePaise as string, 10) : undefined,
      maxPricePaise: maxPricePaise ? parseInt(maxPricePaise as string, 10) : undefined,
      page: page ? parseInt(page as string, 10) : 1,
      limit: limit ? parseInt(limit as string, 10) : 20,
      sortBy: sortBy as any,
      sortOrder: sortOrder as any,
    },
    (req as any).user
  );

  const response: ApiResponse = {
    success: true,
    data: result.items,
    timestamp: new Date().toISOString(),
  };

  res.status(200).json({
    ...response,
    pagination: result.pagination,
  });
});

export const getProductById = asyncHandler(async (req: Request, res: Response) => {
  const productId = Array.isArray(req.params.id) ? req.params.id[0] : (req.params.id as string);
  const product = await productService.getProductById(productId, (req as any).user);
  const response: ApiResponse = {
    success: true,
    data: product,
    timestamp: new Date().toISOString(),
  };
  res.status(200).json(response);
});

export const createProduct = asyncHandler(async (req: Request, res: Response) => {
  const actorId = (req as any).user?.id || (req as any).user?._id?.toString();
  const actorName = (req as any).user?.name || 'Administrator';
  const product = await productService.createProduct(req.body, actorId, actorName);
  const response: ApiResponse = {
    success: true,
    message: 'Product created successfully',
    data: product,
    timestamp: new Date().toISOString(),
  };
  res.status(201).json(response);
});

export const updateProduct = asyncHandler(async (req: Request, res: Response) => {
  const actorId = (req as any).user?.id || (req as any).user?._id?.toString();
  const actorName = (req as any).user?.name || 'Administrator';
  const productId = Array.isArray(req.params.id) ? req.params.id[0] : (req.params.id as string);
  const product = await productService.updateProduct(productId, req.body, actorId, actorName);
  const response: ApiResponse = {
    success: true,
    message: 'Product updated successfully',
    data: product,
    timestamp: new Date().toISOString(),
  };
  res.status(200).json(response);
});

export const duplicateProduct = asyncHandler(async (req: Request, res: Response) => {
  const actorId = (req as any).user?.id || (req as any).user?._id?.toString();
  const actorName = (req as any).user?.name || 'Administrator';
  const productId = Array.isArray(req.params.id) ? req.params.id[0] : (req.params.id as string);
  const { newSku, newName } = req.body;
  const product = await productService.duplicateProduct(productId, newSku, newName, actorId, actorName);
  const response: ApiResponse = {
    success: true,
    message: 'Product duplicated successfully',
    data: product,
    timestamp: new Date().toISOString(),
  };
  res.status(201).json(response);
});

export const updateProductStatus = asyncHandler(async (req: Request, res: Response) => {
  const actorId = (req as any).user?.id || (req as any).user?._id?.toString();
  const productId = Array.isArray(req.params.id) ? req.params.id[0] : (req.params.id as string);
  const { isActive } = req.body;
  const product = await productService.updateProductStatus(productId, Boolean(isActive), actorId);
  const response: ApiResponse = {
    success: true,
    message: `Product ${isActive ? 'activated' : 'deactivated'} successfully`,
    data: product,
    timestamp: new Date().toISOString(),
  };
  res.status(200).json(response);
});

export const deleteProduct = asyncHandler(async (req: Request, res: Response) => {
  const actorId = (req as any).user?.id || (req as any).user?._id?.toString();
  const actorName = (req as any).user?.name || 'Administrator';
  const productId = Array.isArray(req.params.id) ? req.params.id[0] : (req.params.id as string);
  const result = await productService.deleteProduct(productId, actorId, actorName);
  const response: ApiResponse = {
    success: true,
    message: result.message,
    data: result,
    timestamp: new Date().toISOString(),
  };
  res.status(200).json(response);
});

export const bulkUpdateProductStatus = asyncHandler(async (req: Request, res: Response) => {
  const actorId = (req as any).user?.id || (req as any).user?._id?.toString();
  const { productIds, action } = req.body;
  const result = await productService.bulkUpdateProductStatus(productIds, action, actorId);
  const response: ApiResponse = {
    success: true,
    message: `Bulk operation '${action}' applied to ${result.modifiedCount} products`,
    data: result,
    timestamp: new Date().toISOString(),
  };
  res.status(200).json(response);
});

export const adjustStock = asyncHandler(async (req: Request, res: Response) => {
  const actorId = (req as any).user?.id || (req as any).user?._id?.toString();
  const actorName = (req as any).user?.name || 'Administrator';
  const productId = Array.isArray(req.params.id) ? req.params.id[0] : (req.params.id as string);
  const result = await productService.adjustStock(productId, req.body, actorId, actorName);
  const response: ApiResponse = {
    success: true,
    message: 'Inventory stock adjusted successfully',
    data: result,
    timestamp: new Date().toISOString(),
  };
  res.status(200).json(response);
});

export const getStockOverview = asyncHandler(async (_req: Request, res: Response) => {
  const overview = await productService.getStockOverview();
  const response: ApiResponse = {
    success: true,
    data: overview,
    timestamp: new Date().toISOString(),
  };
  res.status(200).json(response);
});

export const getStockTransactions = asyncHandler(async (req: Request, res: Response) => {
  const { productId, sku, transactionType, page, limit } = req.query;
  const result = await productService.getStockTransactions({
    productId: productId as string,
    sku: sku as string,
    transactionType: transactionType as string,
    page: page ? parseInt(page as string, 10) : 1,
    limit: limit ? parseInt(limit as string, 10) : 20,
  });

  const response: ApiResponse = {
    success: true,
    data: result.items,
    timestamp: new Date().toISOString(),
  };

  res.status(200).json({
    ...response,
    pagination: result.pagination,
  });
});

export const importProducts = asyncHandler(async (req: Request, res: Response) => {
  const actorId = (req as any).user?.id || (req as any).user?._id?.toString();
  const actorName = (req as any).user?.name || 'Administrator';
  const { items, options } = req.body;
  const summary = await productService.importProducts(items, options, actorId, actorName);
  const response: ApiResponse = {
    success: true,
    message: `Import complete: ${summary.created} created, ${summary.updated} updated, ${summary.failed} failed`,
    data: summary,
    timestamp: new Date().toISOString(),
  };
  res.status(200).json(response);
});

export const exportProducts = asyncHandler(async (req: Request, res: Response) => {
  const { search, categoryId, brand, status, stockFilter } = req.query;
  const exportData = await productService.exportProducts({
    search: search as string,
    categoryId: categoryId as string,
    brand: brand as string,
    status: status as any,
    stockFilter: stockFilter as any,
  });

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename="${exportData.filename}"`);
  res.status(200).send(exportData.csvContent);
});

// Categories
export const getCategories = asyncHandler(async (_req: Request, res: Response) => {
  const categories = await productService.getCategories();
  const response: ApiResponse = {
    success: true,
    data: categories,
    timestamp: new Date().toISOString(),
  };
  res.status(200).json(response);
});

export const createCategory = asyncHandler(async (req: Request, res: Response) => {
  const category = await productService.createCategory(req.body);
  const response: ApiResponse = {
    success: true,
    message: 'Category created successfully',
    data: category,
    timestamp: new Date().toISOString(),
  };
  res.status(201).json(response);
});

export const updateCategory = asyncHandler(async (req: Request, res: Response) => {
  const categoryId = Array.isArray(req.params.id) ? req.params.id[0] : (req.params.id as string);
  const category = await productService.updateCategory(categoryId, req.body);
  const response: ApiResponse = {
    success: true,
    message: 'Category updated successfully',
    data: category,
    timestamp: new Date().toISOString(),
  };
  res.status(200).json(response);
});

export const deleteCategory = asyncHandler(async (req: Request, res: Response) => {
  const categoryId = Array.isArray(req.params.id) ? req.params.id[0] : (req.params.id as string);
  const category = await productService.deleteCategory(categoryId);
  const response: ApiResponse = {
    success: true,
    message: 'Category deleted successfully',
    data: category,
    timestamp: new Date().toISOString(),
  };
  res.status(200).json(response);
});

// Brands
export const getBrands = asyncHandler(async (_req: Request, res: Response) => {
  const brands = await productService.getBrands();
  const response: ApiResponse = {
    success: true,
    data: brands,
    timestamp: new Date().toISOString(),
  };
  res.status(200).json(response);
});

export const createBrand = asyncHandler(async (req: Request, res: Response) => {
  const brand = await productService.createBrand(req.body);
  const response: ApiResponse = {
    success: true,
    message: 'Brand created successfully',
    data: brand,
    timestamp: new Date().toISOString(),
  };
  res.status(201).json(response);
});

export const updateBrand = asyncHandler(async (req: Request, res: Response) => {
  const brandId = Array.isArray(req.params.id) ? req.params.id[0] : (req.params.id as string);
  const brand = await productService.updateBrand(brandId, req.body);
  const response: ApiResponse = {
    success: true,
    message: 'Brand updated successfully',
    data: brand,
    timestamp: new Date().toISOString(),
  };
  res.status(200).json(response);
});

export const deleteBrand = asyncHandler(async (req: Request, res: Response) => {
  const brandId = Array.isArray(req.params.id) ? req.params.id[0] : (req.params.id as string);
  const brand = await productService.deleteBrand(brandId);
  const response: ApiResponse = {
    success: true,
    message: 'Brand deleted successfully',
    data: brand,
    timestamp: new Date().toISOString(),
  };
  res.status(200).json(response);
});

// Zoho Inventory
export const getZohoSyncOverview = asyncHandler(async (_req: Request, res: Response) => {
  const overview = await productService.getZohoSyncOverview();
  const response: ApiResponse = {
    success: true,
    data: overview,
    timestamp: new Date().toISOString(),
  };
  res.status(200).json(response);
});

export const syncProductToZoho = asyncHandler(async (req: Request, res: Response) => {
  const productId = Array.isArray(req.params.id) ? req.params.id[0] : (req.params.id as string);
  const result = await productService.syncProductToZoho(productId);
  const response: ApiResponse = {
    success: result.success,
    message: result.message,
    data: result.product,
    timestamp: new Date().toISOString(),
  };
  res.status(200).json(response);
});

export const syncAllProductsToZoho = asyncHandler(async (_req: Request, res: Response) => {
  const result = await productService.syncAllProductsToZoho();
  const response: ApiResponse = {
    success: true,
    message: result.message,
    data: result,
    timestamp: new Date().toISOString(),
  };
  res.status(200).json(response);
});

export const uploadProductImage = asyncHandler(async (req: Request, res: Response) => {
  const { fileBase64, fileName } = req.body;
  const result = await productService.uploadProductImage(fileBase64, fileName);
  const response: ApiResponse = {
    success: true,
    message: 'Image uploaded successfully',
    data: result,
    timestamp: new Date().toISOString(),
  };
  res.status(201).json(response);
});

export const uploadProductVideo = asyncHandler(async (req: Request, res: Response) => {
  const { fileBase64, fileName } = req.body;
  const result = await productService.uploadProductVideo(fileBase64, fileName);
  const response: ApiResponse = {
    success: true,
    message: 'Video uploaded successfully',
    data: result,
    timestamp: new Date().toISOString(),
  };
  res.status(201).json(response);
});

export const deleteVariant = asyncHandler(async (req: Request, res: Response) => {
  const actorId = (req as any).user?.id || (req as any).user?._id?.toString();
  const productId = Array.isArray(req.params.id) ? req.params.id[0] : (req.params.id as string);
  const variantId = Array.isArray(req.params.variantId) ? req.params.variantId[0] : (req.params.variantId as string);
  const product = await productService.deleteVariant(productId, variantId, actorId);
  const response: ApiResponse = {
    success: true,
    message: 'Product variant removed successfully',
    data: product,
    timestamp: new Date().toISOString(),
  };
  res.status(200).json(response);
});

export const updateVariantStatus = asyncHandler(async (req: Request, res: Response) => {
  const actorId = (req as any).user?.id || (req as any).user?._id?.toString();
  const productId = Array.isArray(req.params.id) ? req.params.id[0] : (req.params.id as string);
  const variantId = Array.isArray(req.params.variantId) ? req.params.variantId[0] : (req.params.variantId as string);
  const { isActive } = req.body;
  const product = await productService.updateVariantStatus(productId, variantId, Boolean(isActive), actorId);
  const response: ApiResponse = {
    success: true,
    message: `Product variant ${isActive ? 'activated' : 'deactivated'} successfully`,
    data: product,
    timestamp: new Date().toISOString(),
  };
  res.status(200).json(response);
});

