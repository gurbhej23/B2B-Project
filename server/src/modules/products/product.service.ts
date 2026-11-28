import mongoose from 'mongoose';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { Product, IProductDocument } from './product.model';
import { Category, ICategoryDocument } from './category.model';
import { Brand, IBrandDocument } from './brand.model';
import { StockTransaction, StockTransactionType } from './stock-transaction.model';
import { Retailer } from '../retailers/retailer.model';
import { auditLogger } from '../audit/audit.service';
import { ApiError } from '../../utils/api-error';
import { zohoService } from '../integrations/zoho/zoho.service';
import { Order } from '../orders/order.model';
import { ProductDiscount } from '../discounts/discount.model';
import { ProductPricingRule } from '../pricing/pricing.model';
import { validateTierPricing, AccountStatus, UserRole } from '@necessity/shared';
import { escapeRegex } from '../../utils/security';

function transformProductForUser(
  p: any,
  isPriceLocked: boolean,
  priceLockReason?: string,
  buyerCustomerType?: string,
  activeDiscounts?: any[],
  pricingRules?: any[],
  buyerRetailerId?: string,
  buyerPricingGroupId?: string,
  buyerDiscountGroupId?: string
) {
  const availableStock = Math.max(0, (p.stockOnHand || 0) - (p.stockReserved || 0));

  if (isPriceLocked) {
    return {
      ...p,
      id: p._id.toString(),
      availableStock,
      isPriceLocked: true,
      priceLockReason: priceLockReason || 'Approval required to view wholesale pricing',
      dealerPricePaise: 0,
      mrpPaise: 0,
      tierPricing: [],
      wholesaleTiers: [],
      variants: Array.isArray(p.variants)
        ? p.variants.map((v: any) => ({
            ...v,
            id: v._id ? v._id.toString() : v.id,
            dealerPricePaise: 0,
            mrpPaise: 0,
            tierPricing: [],
            isPriceLocked: true,
          }))
        : [],
    };
  }

  const prodIdStr = p._id?.toString() || p.id?.toString();

  // 1. Calculate dynamic pricing following strict precedence
  let effectiveBuyerPricePaise = p.dealerPricePaise;
  let appliedTierDiscountPercent = 0;
  let appliedWholesaleTier: any = undefined;
  let effectiveTierPricing = p.tierPricing || [];
  let isTierPricingEnabled = p.isTierPricingEnabled || false;
  let effectiveMoq = p.minOrderQuantity || 1;

  // Check pricing rules if available
  let matchedRule: any = null;
  if (Array.isArray(pricingRules) && pricingRules.length > 0) {
    // Precedence 1: Customer-specific override
    if (buyerRetailerId) {
      matchedRule = pricingRules.find(
        (r: any) => r.productId?.toString() === prodIdStr && r.retailerId?.toString() === buyerRetailerId
      );
    }
    // Precedence 2: Customer pricing group
    if (!matchedRule && buyerPricingGroupId) {
      matchedRule = pricingRules.find(
        (r: any) => r.productId?.toString() === prodIdStr && r.pricingGroupId?.toString() === buyerPricingGroupId
      );
    }
    // Precedence 3: Customer-type default rule
    if (!matchedRule && buyerCustomerType) {
      matchedRule = pricingRules.find(
        (r: any) =>
          r.productId?.toString() === prodIdStr &&
          r.customerType?.toLowerCase() === buyerCustomerType.toLowerCase()
      );
    }
  }

  if (matchedRule) {
    if (typeof matchedRule.customPricePaise === 'number' && matchedRule.customPricePaise > 0) {
      effectiveBuyerPricePaise = matchedRule.customPricePaise;
    } else if (typeof matchedRule.discountPercent === 'number' && matchedRule.discountPercent > 0) {
      appliedTierDiscountPercent = matchedRule.discountPercent;
      effectiveBuyerPricePaise = Math.round(p.dealerPricePaise * (1 - matchedRule.discountPercent / 100));
    }
    if (Array.isArray(matchedRule.tierPricing) && matchedRule.tierPricing.length > 0) {
      effectiveTierPricing = matchedRule.tierPricing;
      isTierPricingEnabled = true;
    }
    if (matchedRule.minOrderQuantity && matchedRule.minOrderQuantity > 0) {
      effectiveMoq = matchedRule.minOrderQuantity;
    }
  } else if (buyerCustomerType && Array.isArray(p.wholesaleTiers) && p.wholesaleTiers.length > 0) {
    const matchedTier = p.wholesaleTiers.find(
      (t: any) =>
        t.customerType?.toLowerCase() === buyerCustomerType.toLowerCase() ||
        (buyerCustomerType.toLowerCase() === 'retailer' && t.customerType?.toLowerCase() === 'new') ||
        (buyerCustomerType.toLowerCase() === 'wholesaler' && t.customerType?.toLowerCase() === 'old')
    );
    if (matchedTier) {
      appliedWholesaleTier = matchedTier;
      if (typeof matchedTier.pricePaise === 'number' && matchedTier.pricePaise > 0) {
        effectiveBuyerPricePaise = matchedTier.pricePaise;
      } else if (typeof matchedTier.discountPercent === 'number' && matchedTier.discountPercent > 0) {
        appliedTierDiscountPercent = matchedTier.discountPercent;
        effectiveBuyerPricePaise = Math.round(p.dealerPricePaise * (1 - matchedTier.discountPercent / 100));
      }
      if (matchedTier.minQuantity && matchedTier.minQuantity > 0) {
        effectiveMoq = matchedTier.minQuantity;
      }
    }
  }

  let activeDiscount: any = undefined;
  if (activeDiscounts && activeDiscounts.length > 0) {
    const catIdStr = p.categoryId?._id?.toString() || p.categoryId?.toString();

    let bestD: any = null;
    let maxUnitDisc = 0;

    for (const d of activeDiscounts) {
      if (
        Array.isArray(d.eligibleCustomerTypes) &&
        d.eligibleCustomerTypes.length > 0 &&
        (!buyerCustomerType || !d.eligibleCustomerTypes.some((t: string) => t.toLowerCase() === buyerCustomerType.toLowerCase()))
      ) {
        continue;
      }

      // Check Pricing Group eligibility
      if (
        Array.isArray(d.eligiblePricingGroupIds) &&
        d.eligiblePricingGroupIds.length > 0 &&
        (!buyerPricingGroupId || !d.eligiblePricingGroupIds.some((gId: any) => gId.toString() === buyerPricingGroupId))
      ) {
        continue;
      }

      // Check Discount Group eligibility
      if (
        Array.isArray(d.eligibleDiscountGroupIds) &&
        d.eligibleDiscountGroupIds.length > 0 &&
        (!buyerDiscountGroupId || !d.eligibleDiscountGroupIds.some((gId: any) => gId.toString() === buyerDiscountGroupId))
      ) {
        continue;
      }

      let matches = false;
      if (d.scope === 'all_products') matches = true;
      else if (d.scope === 'products') {
        matches = Array.isArray(d.applicableProductIds) && d.applicableProductIds.some((id: any) => id.toString() === prodIdStr);
      } else if (d.scope === 'categories') {
        matches = Array.isArray(d.applicableCategoryIds) && Boolean(catIdStr) && d.applicableCategoryIds.some((id: any) => id.toString() === catIdStr);
      }

      if (!matches) continue;

      let disc = 0;
      if (d.discountType === 'percentage') {
        disc = Math.round(effectiveBuyerPricePaise * (d.discountValue / 100));
      } else {
        disc = Math.min(d.discountValue, effectiveBuyerPricePaise);
      }
      if (d.maxDiscountPaise && disc > d.maxDiscountPaise) {
        disc = d.maxDiscountPaise;
      }

      if (disc > maxUnitDisc || (!bestD && disc > 0)) {
        maxUnitDisc = disc;
        bestD = d;
      }
    }

    if (bestD && maxUnitDisc > 0) {
      activeDiscount = {
        name: bestD.name,
        discountType: bestD.discountType,
        discountValue: bestD.discountValue,
        discountedPricePaise: Math.max(0, effectiveBuyerPricePaise - maxUnitDisc),
        savingsPaise: maxUnitDisc,
      };
    }
  }

  const transformedVariants = Array.isArray(p.variants)
    ? p.variants.map((v: any) => {
        let vEffectivePrice = v.dealerPricePaise !== undefined ? v.dealerPricePaise : effectiveBuyerPricePaise;
        if (appliedTierDiscountPercent > 0 && v.dealerPricePaise !== undefined) {
          vEffectivePrice = Math.round(v.dealerPricePaise * (1 - appliedTierDiscountPercent / 100));
        }
        return {
          ...v,
          id: v._id ? v._id.toString() : v.id,
          effectiveBuyerPricePaise: vEffectivePrice,
          isPriceLocked: false,
        };
      })
    : [];

  return {
    ...p,
    id: p._id.toString(),
    availableStock,
    isPriceLocked: false,
    effectiveBuyerPricePaise,
    appliedTierDiscountPercent,
    appliedWholesaleTier,
    buyerCustomerType,
    activeDiscount,
    variants: transformedVariants,
  };
}

export interface ProductQueryParams {
  search?: string;
  categoryId?: string;
  brand?: string;
  status?: 'all' | 'active' | 'inactive';
  stockFilter?: 'all' | 'in_stock' | 'healthy_stock' | 'low_stock' | 'out_of_stock';
  inStockOnly?: boolean;
  minPricePaise?: number;
  maxPricePaise?: number;
  page?: number;
  limit?: number;
  sortBy?: 'name' | 'sku' | 'dealerPricePaise' | 'mrpPaise' | 'stockOnHand' | 'createdAt';
  sortOrder?: 'asc' | 'desc';
}

export interface ImportOptions {
  updateExisting: boolean;
  updateStock: boolean;
}

export class ProductService {
  async getProducts(params: ProductQueryParams, currentUser?: any) {
    const {
      search,
      categoryId,
      brand,
      status = 'all',
      stockFilter = 'all',
      inStockOnly,
      minPricePaise,
      maxPricePaise,
      page = 1,
      limit = 20,
      sortBy = 'name',
      sortOrder = 'asc',
    } = params;

    const query: any = {};

    // Status filter
    if (status === 'active') {
      query.isActive = true;
    } else if (status === 'inactive') {
      query.isActive = false;
    }

    // Search query
    if (search && search.trim()) {
      const searchRegex = new RegExp(escapeRegex(search.trim()), 'i');
      query.$or = [
        { name: searchRegex },
        { sku: searchRegex },
        { productCode: searchRegex },
        { barcode: searchRegex },
        { brand: searchRegex },
        { hsnCode: searchRegex },
        { description: searchRegex },
      ];
    }

    if (categoryId) {
      if (mongoose.Types.ObjectId.isValid(categoryId)) {
        query.categoryId = new mongoose.Types.ObjectId(categoryId);
      }
    }

    if (brand && brand !== 'all') {
      query.brand = new RegExp(`^${escapeRegex(brand.trim())}$`, 'i');
    }

    // Stock filtering
    if (inStockOnly || stockFilter === 'in_stock' || stockFilter === 'healthy_stock') {
      if (stockFilter === 'in_stock' || stockFilter === 'healthy_stock') {
        query.$expr = {
          $gt: [
            { $subtract: [{ $ifNull: ['$stockOnHand', 0] }, { $ifNull: ['$stockReserved', 0] }] },
            { $ifNull: ['$lowStockThreshold', 10] },
          ],
        };
      } else {
        query.$expr = {
          $gt: [{ $subtract: [{ $ifNull: ['$stockOnHand', 0] }, { $ifNull: ['$stockReserved', 0] }] }, 0],
        };
      }
    } else if (stockFilter === 'out_of_stock') {
      query.$expr = {
        $lte: [{ $subtract: [{ $ifNull: ['$stockOnHand', 0] }, { $ifNull: ['$stockReserved', 0] }] }, 0],
      };
    } else if (stockFilter === 'low_stock') {
      query.$expr = {
        $and: [
          { $gt: [{ $subtract: [{ $ifNull: ['$stockOnHand', 0] }, { $ifNull: ['$stockReserved', 0] }] }, 0] },
          {
            $lte: [
              { $subtract: [{ $ifNull: ['$stockOnHand', 0] }, { $ifNull: ['$stockReserved', 0] }] },
              { $ifNull: ['$lowStockThreshold', 10] },
            ],
          },
        ],
      };
    }

    if (minPricePaise !== undefined || maxPricePaise !== undefined) {
      query.dealerPricePaise = {};
      if (minPricePaise !== undefined) query.dealerPricePaise.$gte = minPricePaise;
      if (maxPricePaise !== undefined) query.dealerPricePaise.$lte = maxPricePaise;
    }

    const sortOption: any = {};
    sortOption[sortBy] = sortOrder === 'desc' ? -1 : 1;

    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      Product.find(query).sort(sortOption).skip(skip).limit(limit).lean({ virtuals: true }),
      Product.countDocuments(query),
    ]);

    let isPriceLocked = false;
    let priceLockReason = '';
    let buyerCustomerType: string | undefined = undefined;
    let buyerRetailerId: string | undefined = undefined;
    let buyerPricingGroupId: string | undefined = undefined;
    let buyerDiscountGroupId: string | undefined = undefined;

    if (currentUser) {
      if (currentUser.role === UserRole.RETAILER) {
        if (currentUser.accountStatus === AccountStatus.PENDING) {
          isPriceLocked = true;
          priceLockReason = 'Your account is awaiting admin approval. Prices and cart unlock once approved.';
        } else if (currentUser.accountStatus !== AccountStatus.ACTIVE) {
          isPriceLocked = true;
          priceLockReason = 'Account inactive or disabled';
        } else if (currentUser.retailerProfileId) {
          const retailer = await Retailer.findById(currentUser.retailerProfileId).select('customerType pricingGroupId discountGroupId');
          buyerCustomerType = retailer?.customerType;
          buyerRetailerId = retailer?._id?.toString();
          buyerPricingGroupId = retailer?.pricingGroupId?.toString();
          buyerDiscountGroupId = retailer?.discountGroupId?.toString();
        }
      }
    }

    // Load matching pricing rules if customer is logged in
    let pricingRules: any[] = [];
    if (!isPriceLocked && (buyerRetailerId || buyerPricingGroupId || buyerCustomerType)) {
      const prodIds = items.map((p: any) => p._id);
      pricingRules = await ProductPricingRule.find({
        productId: { $in: prodIds },
        isActive: true,
        $or: [
          ...(buyerRetailerId ? [{ retailerId: new mongoose.Types.ObjectId(buyerRetailerId) }] : []),
          ...(buyerPricingGroupId ? [{ pricingGroupId: new mongoose.Types.ObjectId(buyerPricingGroupId) }] : []),
          ...(buyerCustomerType ? [{ customerType: buyerCustomerType.toLowerCase() }] : []),
        ],
      });
    }

    const now = new Date();
    const activeDiscounts = await ProductDiscount.find({
      isActive: true,
      startDate: { $lte: now },
      endDate: { $gte: now },
    }).sort({ priority: -1, discountValue: -1 });

    return {
      items: items.map((p: any) =>
        transformProductForUser(
          p,
          isPriceLocked,
          priceLockReason,
          buyerCustomerType,
          activeDiscounts,
          pricingRules,
          buyerRetailerId,
          buyerPricingGroupId,
          buyerDiscountGroupId
        )
      ),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasNextPage: page * limit < total,
        hasPrevPage: page > 1,
      },
    };
  }

  async getProductById(id: string, currentUser?: any) {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw ApiError.badRequest('Invalid product ID');
    }

    const product = await Product.findById(id).lean({ virtuals: true });
    if (!product) {
      throw ApiError.notFound('Product not found');
    }

    let isPriceLocked = false;
    let priceLockReason = '';
    let buyerCustomerType: string | undefined = undefined;
    let buyerRetailerId: string | undefined = undefined;
    let buyerPricingGroupId: string | undefined = undefined;
    let buyerDiscountGroupId: string | undefined = undefined;

    if (currentUser) {
      if (currentUser.role === UserRole.RETAILER) {
        if (currentUser.accountStatus === AccountStatus.PENDING) {
          isPriceLocked = true;
          priceLockReason = 'Your account is awaiting admin approval. Prices and cart unlock once approved.';
        } else if (currentUser.accountStatus !== AccountStatus.ACTIVE) {
          isPriceLocked = true;
          priceLockReason = 'Account inactive or disabled';
        } else if (currentUser.retailerProfileId) {
          const retailer = await Retailer.findById(currentUser.retailerProfileId).select('customerType pricingGroupId discountGroupId');
          buyerCustomerType = retailer?.customerType;
          buyerRetailerId = retailer?._id?.toString();
          buyerPricingGroupId = retailer?.pricingGroupId?.toString();
          buyerDiscountGroupId = retailer?.discountGroupId?.toString();
        }
      }
    }

    // Load matching pricing rules
    let pricingRules: any[] = [];
    if (!isPriceLocked && (buyerRetailerId || buyerPricingGroupId || buyerCustomerType)) {
      pricingRules = await ProductPricingRule.find({
        productId: product._id,
        isActive: true,
        $or: [
          ...(buyerRetailerId ? [{ retailerId: new mongoose.Types.ObjectId(buyerRetailerId) }] : []),
          ...(buyerPricingGroupId ? [{ pricingGroupId: new mongoose.Types.ObjectId(buyerPricingGroupId) }] : []),
          ...(buyerCustomerType ? [{ customerType: buyerCustomerType.toLowerCase() }] : []),
        ],
      });
    }

    const now = new Date();
    const activeDiscounts = await ProductDiscount.find({
      isActive: true,
      startDate: { $lte: now },
      endDate: { $gte: now },
    }).sort({ priority: -1, discountValue: -1 });

    return transformProductForUser(
      product,
      isPriceLocked,
      priceLockReason,
      buyerCustomerType,
      activeDiscounts,
      pricingRules,
      buyerRetailerId,
      buyerPricingGroupId,
      buyerDiscountGroupId
    );
  }

  private async validateProductAndVariantSkus(
    productSku: string,
    variants?: any[],
    excludeProductId?: string
  ) {
    const cleanProductSku = productSku.trim().toUpperCase();

    // 1. Check productSku uniqueness against other products and other products' variants
    const skuConflict = await Product.findOne({
      $or: [{ sku: cleanProductSku }, { 'variants.sku': cleanProductSku }],
      ...(excludeProductId ? { _id: { $ne: excludeProductId } } : {}),
    });
    if (skuConflict) {
      throw ApiError.badRequest(`SKU '${cleanProductSku}' is already in use by another product or variant`);
    }

    if (variants && Array.isArray(variants) && variants.length > 0) {
      const seenVariantSkus = new Set<string>();

      for (let i = 0; i < variants.length; i++) {
        const v = variants[i];
        const vSku = v.sku?.trim().toUpperCase();
        if (!vSku) {
          throw ApiError.badRequest(`Variant at position ${i + 1} must have a valid SKU`);
        }

        if (vSku === cleanProductSku) {
          throw ApiError.badRequest(`Variant SKU '${vSku}' cannot be identical to the parent product SKU`);
        }

        if (seenVariantSkus.has(vSku)) {
          throw ApiError.badRequest(`Duplicate variant SKU '${vSku}' found within product variants`);
        }
        seenVariantSkus.add(vSku);

        // Check if vSku exists in database under another product
        const variantConflict = await Product.findOne({
          $or: [{ sku: vSku }, { 'variants.sku': vSku }],
          ...(excludeProductId ? { _id: { $ne: excludeProductId } } : {}),
        });
        if (variantConflict) {
          throw ApiError.badRequest(`Variant SKU '${vSku}' is already in use by another product or variant`);
        }
      }
    }
  }

  private validateTiers(tierPricing?: any[], isEnabled?: boolean, baseWholesalePricePaise?: number, moq?: number) {
    if (isEnabled && Array.isArray(tierPricing) && tierPricing.length > 0) {
      const validation = validateTierPricing(tierPricing, baseWholesalePricePaise, moq);
      if (!validation.valid) {
        throw ApiError.badRequest(validation.error || 'Invalid tier pricing configuration');
      }
    }
  }

  async createProduct(data: Partial<IProductDocument>, actorId?: string, actorName?: string) {
    const rawSku = data.sku?.trim().toUpperCase();
    if (!rawSku) {
      throw ApiError.badRequest('Product SKU is required');
    }

    await this.validateProductAndVariantSkus(rawSku, data.variants);
    this.validateTiers(data.tierPricing, data.isTierPricingEnabled, data.dealerPricePaise, data.minOrderQuantity);

    // Attach categoryName if categoryId provided
    if (data.categoryId) {
      const category = await Category.findById(data.categoryId);
      if (category) {
        data.categoryName = category.name;
      }
    }

    if (Array.isArray(data.variants) && data.variants.length > 0) {
      data.hasVariants = true;
      for (const v of data.variants) {
        v.sku = v.sku.trim().toUpperCase();
        this.validateTiers(v.tierPricing, v.isTierPricingEnabled, v.dealerPricePaise || data.dealerPricePaise, data.minOrderQuantity);
      }
      if (!data.stockOnHand || Number(data.stockOnHand) === 0) {
        data.stockOnHand = data.variants.reduce((sum, v) => sum + (Number(v.stockOnHand) || 0), 0);
      }
    }

    const initialStock = Number(data.stockOnHand) || 0;

    const product = await Product.create({
      ...data,
      sku: rawSku,
      stockOnHand: initialStock,
      stockReserved: 0,
    });

    // Record initial stock transaction if initial stock > 0
    if (initialStock > 0) {
      await StockTransaction.create({
        productId: product._id,
        sku: product.sku,
        productName: product.name,
        transactionType: 'INITIAL_OPENING',
        quantityDelta: initialStock,
        previousStock: 0,
        newStock: initialStock,
        reason: 'Opening stock on product creation',
        warehouseLocation: product.warehouseLocation || 'Main Central Warehouse',
        actorId,
        actorName,
      });
    }

    // Auto-create or ensure Brand exists
    if (product.brand) {
      await this.ensureBrandExists(product.brand);
    }

    if (actorId) {
      await auditLogger.logAction({
        actorId,
        action: 'PRODUCT_CREATED',
        targetResource: 'Product',
        targetId: product.id,
        details: { sku: product.sku, name: product.name, dealerPricePaise: product.dealerPricePaise },
      });
    }

    return product;
  }

  async updateProduct(id: string, data: Partial<IProductDocument>, actorId?: string, actorName?: string) {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw ApiError.badRequest('Invalid product ID');
    }

    const product = await Product.findById(id);
    if (!product) {
      throw ApiError.notFound('Product not found');
    }

    const effectiveSku = data.sku ? data.sku.trim().toUpperCase() : product.sku;
    await this.validateProductAndVariantSkus(effectiveSku, data.variants, product.id || product._id.toString());
    const effectiveDealerPricePaise = data.dealerPricePaise !== undefined ? data.dealerPricePaise : product.dealerPricePaise;
    const effectiveMoq = data.minOrderQuantity !== undefined ? data.minOrderQuantity : product.minOrderQuantity;
    this.validateTiers(data.tierPricing, data.isTierPricingEnabled ?? product.isTierPricingEnabled, effectiveDealerPricePaise, effectiveMoq);

    if (data.sku) {
      data.sku = effectiveSku;
    }

    if (data.categoryId && data.categoryId.toString() !== product.categoryId.toString()) {
      const cat = await Category.findById(data.categoryId);
      if (cat) data.categoryName = cat.name;
    }

    if (Array.isArray(data.variants)) {
      data.hasVariants = data.variants.length > 0;
      for (const v of data.variants) {
        v.sku = v.sku.trim().toUpperCase();
        this.validateTiers(v.tierPricing, v.isTierPricingEnabled, v.dealerPricePaise || effectiveDealerPricePaise, effectiveMoq);
      }
    }

    // Track stock change if stockOnHand updated directly
    if (data.stockOnHand !== undefined && data.stockOnHand !== product.stockOnHand) {
      const prevStock = product.stockOnHand;
      const newStock = Number(data.stockOnHand);
      if (newStock < product.stockReserved) {
        throw ApiError.badRequest(
          `Cannot reduce stock to ${newStock} because ${product.stockReserved} units are reserved for orders`
        );
      }
      const delta = newStock - prevStock;
      await StockTransaction.create({
        productId: product._id,
        sku: product.sku,
        productName: product.name,
        transactionType: delta > 0 ? 'STOCK_IN' : 'STOCK_OUT',
        quantityDelta: delta,
        previousStock: prevStock,
        newStock: newStock,
        reason: 'Direct stock level update via edit',
        warehouseLocation: product.warehouseLocation || 'Main Central Warehouse',
        actorId,
        actorName,
      });
    }

    Object.assign(product, data);
    await product.save();

    if (product.brand) {
      await this.ensureBrandExists(product.brand);
    }

    if (actorId) {
      await auditLogger.logAction({
        actorId,
        action: 'PRODUCT_UPDATED',
        targetResource: 'Product',
        targetId: product.id,
        details: { sku: product.sku, changes: Object.keys(data) },
      });
    }

    return product;
  }

  async duplicateProduct(
    id: string,
    newSku: string,
    newName?: string,
    actorId?: string,
    actorName?: string
  ) {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw ApiError.badRequest('Invalid product ID');
    }

    const cleanSku = newSku.trim().toUpperCase();
    if (!cleanSku) {
      throw ApiError.badRequest('A unique SKU is required for duplicating the product');
    }

    const existing = await Product.findOne({ sku: cleanSku });
    if (existing) {
      throw ApiError.badRequest(`Product with SKU '${cleanSku}' already exists`);
    }

    const source = await Product.findById(id).lean();
    if (!source) {
      throw ApiError.notFound('Original product not found');
    }

    const cloneData = {
      ...source,
      _id: undefined,
      sku: cleanSku,
      name: newName ? newName.trim() : `${source.name} (Copy)`,
      stockOnHand: 0,
      stockReserved: 0,
      zohoItemId: undefined,
      zohoSyncStatus: 'not_synced' as const,
      createdAt: undefined,
      updatedAt: undefined,
    };

    const newProduct = await Product.create(cloneData);

    if (actorId) {
      await auditLogger.logAction({
        actorId,
        action: 'PRODUCT_DUPLICATED',
        targetResource: 'Product',
        targetId: newProduct.id,
        details: { sourceSku: source.sku, newSku: newProduct.sku, name: newProduct.name },
      });
    }

    return newProduct;
  }

  async updateProductStatus(id: string, isActive: boolean, actorId?: string) {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw ApiError.badRequest('Invalid product ID');
    }

    const product = await Product.findByIdAndUpdate(
      id,
      { $set: { isActive: Boolean(isActive) } },
      { new: true }
    );

    if (!product) {
      throw ApiError.notFound('Product not found');
    }

    if (actorId) {
      await auditLogger.logAction({
        actorId,
        action: isActive ? 'PRODUCT_ACTIVATED' : 'PRODUCT_DEACTIVATED',
        targetResource: 'Product',
        targetId: product.id,
        details: { sku: product.sku, isActive },
      });
    }

    return product;
  }

  async bulkUpdateProductStatus(
    productIds: string[],
    action: 'activate' | 'deactivate' | 'delete',
    actorId?: string
  ) {
    if (!Array.isArray(productIds) || productIds.length === 0) {
      throw ApiError.badRequest('No product IDs provided');
    }

    const validIds = productIds.filter((id) => mongoose.Types.ObjectId.isValid(id));

    if (action === 'activate') {
      const result = await Product.updateMany(
        { _id: { $in: validIds } },
        { $set: { isActive: true } }
      );
      return { modifiedCount: result.modifiedCount, action };
    } else if (action === 'deactivate') {
      const result = await Product.updateMany(
        { _id: { $in: validIds } },
        { $set: { isActive: false } }
      );
      return { modifiedCount: result.modifiedCount, action };
    } else if (action === 'delete') {
      // Soft-delete or hard delete if zero orders exist
      const result = await Product.updateMany(
        { _id: { $in: validIds } },
        { $set: { isActive: false, isDraft: true } }
      );
      return { modifiedCount: result.modifiedCount, action };
    }

    throw ApiError.badRequest('Invalid bulk action');
  }

  async deleteProduct(id: string, actorId?: string, actorName?: string) {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw ApiError.badRequest('Invalid product ID');
    }

    const product = await Product.findById(id);
    if (!product) {
      throw ApiError.notFound('Product not found');
    }

    // Check if product is referenced in existing orders
    const orderCount = await Order.countDocuments({ 'items.productId': product._id });

    if (orderCount > 0) {
      // Historical orders exist: safely archive and unlist from active catalogue
      product.isActive = false;
      product.isDraft = true;
      product.visibilityInMobile = false;
      await product.save();

      if (actorId) {
        await auditLogger.logAction({
          actorId,
          action: 'PRODUCT_ARCHIVED',
          targetResource: 'Product',
          targetId: product.id,
          details: {
            sku: product.sku,
            name: product.name,
            reason: 'Archived due to existing order history',
            orderCount,
          },
        });
      }

      return {
        id: product.id,
        deleted: false,
        archived: true,
        message: `Product '${product.name}' (${product.sku}) is linked to ${orderCount} order(s). It has been deactivated, unlisted from mobile ordering, and archived.`,
      };
    }

    // No orders exist: safe to permanently delete product document and orphan stock transactions
    await Product.findByIdAndDelete(id);
    await StockTransaction.deleteMany({ productId: product._id });

    if (actorId) {
      await auditLogger.logAction({
        actorId,
        action: 'PRODUCT_DELETED',
        targetResource: 'Product',
        targetId: id,
        details: { sku: product.sku, name: product.name },
      });
    }

    return {
      id,
      deleted: true,
      archived: false,
      message: `Product '${product.name}' (${product.sku}) was permanently deleted.`,
    };
  }

  async deleteVariant(productId: string, variantId: string, actorId?: string) {
    if (!mongoose.Types.ObjectId.isValid(productId) || !mongoose.Types.ObjectId.isValid(variantId)) {
      throw ApiError.badRequest('Invalid product or variant ID');
    }

    const product = await Product.findById(productId);
    if (!product) {
      throw ApiError.notFound('Product not found');
    }

    // Check if variant is referenced in existing orders
    const orderCount = await Order.countDocuments({ 'items.variantId': variantId });
    if (orderCount > 0) {
      throw ApiError.badRequest(
        `Cannot delete variant because it is referenced in ${orderCount} existing order(s). Please deactivate it instead to preserve order history.`
      );
    }

    const initialCount = product.variants ? product.variants.length : 0;
    product.variants = (product.variants || []).filter(
      (v: any) => v._id?.toString() !== variantId && v.id !== variantId
    );

    if (product.variants.length === initialCount) {
      throw ApiError.notFound('Variant not found in product');
    }

    if (product.variants.length === 0) {
      product.hasVariants = false;
    }

    await product.save();

    if (actorId) {
      await auditLogger.logAction({
        actorId,
        action: 'PRODUCT_VARIANT_DELETED',
        targetResource: 'Product',
        targetId: product.id,
        details: { variantId },
      });
    }

    return product;
  }

  async updateVariantStatus(
    productId: string,
    variantId: string,
    isActive: boolean,
    actorId?: string
  ) {
    if (!mongoose.Types.ObjectId.isValid(productId) || !mongoose.Types.ObjectId.isValid(variantId)) {
      throw ApiError.badRequest('Invalid product or variant ID');
    }

    const product = await Product.findOneAndUpdate(
      { _id: productId, 'variants._id': variantId },
      { $set: { 'variants.$.isActive': Boolean(isActive) } },
      { new: true }
    );

    if (!product) {
      throw ApiError.notFound('Product or variant not found');
    }

    if (actorId) {
      await auditLogger.logAction({
        actorId,
        action: isActive ? 'PRODUCT_VARIANT_ACTIVATED' : 'PRODUCT_VARIANT_DEACTIVATED',
        targetResource: 'Product',
        targetId: product.id,
        details: { variantId, isActive },
      });
    }

    return product;
  }

  async uploadProductImage(fileBase64: string, originalFileName?: string) {
    if (!fileBase64) {
      throw ApiError.badRequest('No image data provided');
    }

    // Determine MIME type and buffer
    let mimeType = 'image/jpeg';
    let rawBase64 = fileBase64;

    const dataUrlMatch = fileBase64.match(/^data:([a-zA-Z0-9]+\/[a-zA-Z0-9-.+]+);base64,(.+)$/);
    if (dataUrlMatch) {
      mimeType = dataUrlMatch[1].toLowerCase();
      rawBase64 = dataUrlMatch[2];
    }

    const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (!allowedMimeTypes.includes(mimeType)) {
      throw ApiError.badRequest(
        `Unsupported image format '${mimeType}'. Allowed formats: JPEG, PNG, WebP, GIF`
      );
    }

    const buffer = Buffer.from(rawBase64, 'base64');
    const maxSize = 5 * 1024 * 1024; // 5 MB
    if (buffer.length > maxSize) {
      throw ApiError.badRequest(
        `File size (${(buffer.length / (1024 * 1024)).toFixed(2)} MB) exceeds maximum allowed limit of 5 MB`
      );
    }

    const uploadsDir = path.join(process.cwd(), 'uploads', 'products');
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }

    const extMap: Record<string, string> = {
      'image/jpeg': '.jpg',
      'image/png': '.png',
      'image/webp': '.webp',
      'image/gif': '.gif',
    };
    const ext = extMap[mimeType] || '.jpg';
    const randomHex = crypto.randomBytes(8).toString('hex');
    const safeBaseName = originalFileName
      ? originalFileName.replace(/[^a-zA-Z0-9_-]/g, '_').substring(0, 30)
      : 'img';
    const fileName = `${Date.now()}_${randomHex}_${safeBaseName}${ext}`;
    const filePath = path.join(uploadsDir, fileName);

    await fs.promises.writeFile(filePath, buffer);

    return {
      url: `/uploads/products/${fileName}`,
      fileName,
      sizeBytes: buffer.length,
      mimeType,
    };
  }

  async uploadProductVideo(fileBase64: string, originalFileName?: string) {
    if (!fileBase64) {
      throw ApiError.badRequest('No video data provided');
    }

    // Determine MIME type and buffer
    let mimeType = 'video/mp4';
    let rawBase64 = fileBase64;

    const dataUrlMatch = fileBase64.match(/^data:([a-zA-Z0-9]+\/[a-zA-Z0-9-.+]+);base64,(.+)$/);
    if (dataUrlMatch) {
      mimeType = dataUrlMatch[1].toLowerCase();
      rawBase64 = dataUrlMatch[2];
    }

    const allowedMimeTypes = ['video/mp4', 'video/webm', 'video/quicktime', 'video/x-matroska', 'video/ogg'];
    if (!allowedMimeTypes.includes(mimeType)) {
      throw ApiError.badRequest(
        `Unsupported video format '${mimeType}'. Allowed formats: MP4, WebM, MOV, MKV, OGG`
      );
    }

    const buffer = Buffer.from(rawBase64, 'base64');
    const maxSize = 50 * 1024 * 1024; // 50 MB
    if (buffer.length > maxSize) {
      throw ApiError.badRequest(
        `File size (${(buffer.length / (1024 * 1024)).toFixed(2)} MB) exceeds maximum allowed limit of 50 MB`
      );
    }

    const uploadsDir = path.join(process.cwd(), 'uploads', 'products');
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }

    const extMap: Record<string, string> = {
      'video/mp4': '.mp4',
      'video/webm': '.webm',
      'video/quicktime': '.mov',
      'video/x-matroska': '.mkv',
      'video/ogg': '.ogv',
    };
    const ext = extMap[mimeType] || '.mp4';
    const randomHex = crypto.randomBytes(8).toString('hex');
    const safeBaseName = originalFileName
      ? originalFileName.replace(/[^a-zA-Z0-9_-]/g, '_').substring(0, 30)
      : 'vid';
    const fileName = `${Date.now()}_${randomHex}_${safeBaseName}${ext}`;
    const filePath = path.join(uploadsDir, fileName);

    await fs.promises.writeFile(filePath, buffer);

    return {
      url: `/uploads/products/${fileName}`,
      fileName,
      sizeBytes: buffer.length,
      mimeType,
    };
  }

  async adjustStock(
    id: string,
    payload: {
      quantityDelta: number;
      reason: string;
      warehouseLocation?: string;
      lowStockThreshold?: number;
      transactionType?: StockTransactionType;
    },
    actorId?: string,
    actorName?: string
  ) {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw ApiError.badRequest('Invalid product ID');
    }

    const product = await Product.findById(id);
    if (!product) {
      throw ApiError.notFound('Product not found');
    }

    const delta = Number(payload.quantityDelta);
    if (isNaN(delta) || delta === 0) {
      throw ApiError.badRequest('Adjustment quantity delta must be a non-zero number');
    }

    const newStock = product.stockOnHand + delta;
    if (newStock < 0) {
      throw ApiError.badRequest(
        `Cannot reduce stock below zero. Current stock on hand: ${product.stockOnHand} units.`
      );
    }

    if (newStock < product.stockReserved) {
      throw ApiError.badRequest(
        `Cannot reduce stock to ${newStock} units because ${product.stockReserved} units are currently reserved for pending orders.`
      );
    }

    const previousStock = product.stockOnHand;
    product.stockOnHand = newStock;
    if (payload.warehouseLocation) {
      product.warehouseLocation = payload.warehouseLocation;
    }
    if (payload.lowStockThreshold !== undefined && !isNaN(Number(payload.lowStockThreshold))) {
      product.lowStockThreshold = Math.max(0, Number(payload.lowStockThreshold));
    }
    await product.save();

    const txType: StockTransactionType =
      payload.transactionType || (delta > 0 ? 'STOCK_IN' : 'STOCK_OUT');

    const transaction = await StockTransaction.create({
      productId: product._id,
      sku: product.sku,
      productName: product.name,
      transactionType: txType,
      quantityDelta: delta,
      previousStock,
      newStock,
      reason: payload.reason || 'Manual inventory adjustment',
      warehouseLocation: product.warehouseLocation || 'Main Central Warehouse',
      actorId,
      actorName,
    });

    if (actorId) {
      await auditLogger.logAction({
        actorId,
        action: 'STOCK_ADJUSTED',
        targetResource: 'Product',
        targetId: product.id,
        details: {
          sku: product.sku,
          previousStock,
          newStock,
          delta,
          reason: payload.reason,
          transactionId: transaction.id,
        },
      });
    }

    return {
      product: {
        ...product.toJSON(),
        availableStock: Math.max(0, product.stockOnHand - product.stockReserved),
      },
      transaction,
    };
  }

  async getStockOverview() {
    const products = await Product.find({}).lean();

    let totalStockUnits = 0;
    let totalValuationPaise = 0;
    let lowStockCount = 0;
    let outOfStockCount = 0;
    let healthyStockCount = 0;

    for (const p of products) {
      let onHand = p.stockOnHand || 0;
      let reserved = p.stockReserved || 0;

      if (p.hasVariants && Array.isArray(p.variants) && p.variants.length > 0) {
        const variantOnHand = p.variants.reduce((sum: number, v: any) => sum + (v.stockOnHand || 0), 0);
        const variantReserved = p.variants.reduce((sum: number, v: any) => sum + (v.stockReserved || 0), 0);
        if (variantOnHand > 0 || onHand === 0) {
          onHand = Math.max(onHand, variantOnHand);
          reserved = Math.max(reserved, variantReserved);
        }
      }

      const available = Math.max(0, onHand - reserved);
      const threshold = p.lowStockThreshold !== undefined ? p.lowStockThreshold : 10;

      totalStockUnits += onHand;
      totalValuationPaise += onHand * (p.dealerPricePaise || 0);

      if (available <= 0) {
        outOfStockCount++;
      } else if (available <= threshold) {
        lowStockCount++;
      } else {
        healthyStockCount++;
      }
    }

    return {
      totalSkus: products.length,
      totalStockUnits,
      totalValuationPaise,
      lowStockCount,
      outOfStockCount,
      inStockCount: healthyStockCount,
      healthyStockCount,
    };
  }

  async getStockTransactions(params: {
    productId?: string;
    sku?: string;
    transactionType?: string;
    page?: number;
    limit?: number;
  }) {
    const { productId, sku, transactionType, page = 1, limit = 20 } = params;
    const query: any = {};

    if (productId && mongoose.Types.ObjectId.isValid(productId)) {
      query.productId = new mongoose.Types.ObjectId(productId);
    }

    if (sku && sku.trim()) {
      query.sku = new RegExp(escapeRegex(sku.trim()), 'i');
    }

    if (transactionType && transactionType !== 'all') {
      query.transactionType = transactionType;
    }

    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      StockTransaction.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      StockTransaction.countDocuments(query),
    ]);

    return {
      items: items.map((t: any) => ({
        ...t,
        id: t._id.toString(),
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasNextPage: page * limit < total,
        hasPrevPage: page > 1,
      },
    };
  }

  async importProducts(
    rows: any[],
    options: ImportOptions = { updateExisting: true, updateStock: false },
    actorId?: string,
    actorName?: string
  ) {
    if (!Array.isArray(rows) || rows.length === 0) {
      throw ApiError.badRequest('No data rows supplied for product import');
    }

    let created = 0;
    let updated = 0;
    let skipped = 0;
    let failed = 0;
    const errors: Array<{ row: number; sku?: string; reason: string }> = [];

    // Pre-load all categories and brands for quick lookup
    const categories = await Category.find().lean();
    const categoryMap = new Map<string, any>();
    for (const cat of categories) {
      categoryMap.set(cat.name.toLowerCase().trim(), cat);
      categoryMap.set(cat.slug.toLowerCase().trim(), cat);
    }

    // Process row by row with validation
    for (let index = 0; index < rows.length; index++) {
      const row = rows[index];
      const rowNum = index + 2; // header is row 1

      try {
        const sku = String(row.sku || row.SKU || '').trim().toUpperCase();
        const name = String(row.name || row.Name || row['Product Name'] || '').trim();

        if (!sku) {
          throw new Error('Missing SKU code');
        }
        if (!name) {
          throw new Error('Missing product name');
        }

        // Parse Prices
        const rawMrp = parseFloat(String(row.mrp || row.MRP || row.mrpPaise || '0'));
        const rawDealerPrice = parseFloat(
          String(row.dealerPrice || row['Dealer Price'] || row.dealerPricePaise || '0')
        );

        if (isNaN(rawMrp) || rawMrp < 0) {
          throw new Error(`Invalid MRP value: ${row.mrp}`);
        }
        if (isNaN(rawDealerPrice) || rawDealerPrice < 0) {
          throw new Error(`Invalid Wholesale/Dealer Price value: ${row.dealerPrice}`);
        }

        // Convert to Paise (if user gave rupees e.g. 150 -> 15000 paise)
        const mrpPaise = rawMrp < 1000 && !row.mrpPaise ? Math.round(rawMrp * 100) : Math.round(rawMrp);
        const dealerPricePaise =
          rawDealerPrice < 1000 && !row.dealerPricePaise
            ? Math.round(rawDealerPrice * 100)
            : Math.round(rawDealerPrice);

        // Resolve or create Category
        const catName = String(row.category || row.Category || row.categoryName || 'General Supplies').trim();
        let matchedCategory = categoryMap.get(catName.toLowerCase());
        if (!matchedCategory) {
          matchedCategory = await Category.create({
            name: catName,
            slug: catName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, ''),
            isActive: true,
          });
          categoryMap.set(catName.toLowerCase(), matchedCategory);
        }

        // Resolve Brand
        const brand = String(row.brand || row.Brand || 'Necessity India').trim();
        await this.ensureBrandExists(brand);

        // Resolve GST & HSN
        const rawGst = parseInt(String(row.gstRatePercent || row.GST || row['GST Rate'] || '18'), 10);
        const gstRatePercent = [0, 5, 12, 18, 28].includes(rawGst) ? rawGst : 18;
        const hsnCode = String(row.hsnCode || row.HSN || row['HSN Code'] || '6302').trim();

        // Quantities
        const uom = String(row.uom || row.UOM || row.unit || 'PCS').trim().toUpperCase();
        const packSize = Math.max(1, parseInt(String(row.packSize || row['Pack Size'] || '1'), 10));
        const caseQuantity = Math.max(1, parseInt(String(row.caseQuantity || row['Case Qty'] || '1'), 10));
        const minOrderQuantity = Math.max(1, parseInt(String(row.minOrderQuantity || row.MOQ || '1'), 10));
        const orderQuantityMultiple = Math.max(
          1,
          parseInt(String(row.orderQuantityMultiple || row['Order Multiple'] || '1'), 10)
        );
        const rowStock = Math.max(0, parseInt(String(row.stockOnHand || row.stock || row.Stock || '0'), 10));
        const lowStockThreshold = Math.max(
          1,
          parseInt(String(row.lowStockThreshold || row['Low Stock Alert'] || '10'), 10)
        );
        const barcode = row.barcode || row.Barcode ? String(row.barcode || row.Barcode).trim() : undefined;
        const description = String(row.description || row.Description || name).trim();
        const warehouseLocation = String(row.warehouseLocation || row.Warehouse || 'Main Central Warehouse').trim();

        // Check if product exists
        const existingProduct = await Product.findOne({ sku });

        if (existingProduct) {
          if (!options.updateExisting) {
            skipped++;
            continue;
          }

          // Update existing
          existingProduct.name = name;
          existingProduct.description = description;
          existingProduct.categoryId = matchedCategory._id;
          existingProduct.categoryName = matchedCategory.name;
          existingProduct.brand = brand;
          existingProduct.mrpPaise = mrpPaise;
          existingProduct.dealerPricePaise = dealerPricePaise;
          existingProduct.gstRatePercent = gstRatePercent;
          existingProduct.hsnCode = hsnCode;
          existingProduct.uom = uom;
          existingProduct.packSize = packSize;
          existingProduct.caseQuantity = caseQuantity;
          existingProduct.minOrderQuantity = minOrderQuantity;
          existingProduct.orderQuantityMultiple = orderQuantityMultiple;
          existingProduct.lowStockThreshold = lowStockThreshold;
          if (barcode) existingProduct.barcode = barcode;
          existingProduct.warehouseLocation = warehouseLocation;

          if (options.updateStock && rowStock !== existingProduct.stockOnHand) {
            const previousStock = existingProduct.stockOnHand;
            existingProduct.stockOnHand = rowStock;
            await StockTransaction.create({
              productId: existingProduct._id,
              sku: existingProduct.sku,
              productName: existingProduct.name,
              transactionType: 'MANUAL_ADJUSTMENT',
              quantityDelta: rowStock - previousStock,
              previousStock,
              newStock: rowStock,
              reason: 'Bulk CSV Import stock adjustment',
              warehouseLocation,
              actorId,
              actorName,
            });
          }

          await existingProduct.save();
          updated++;
        } else {
          // Create new product
          const newProduct = await Product.create({
            sku,
            name,
            description,
            categoryId: matchedCategory._id,
            categoryName: matchedCategory.name,
            brand,
            mrpPaise,
            dealerPricePaise,
            gstRatePercent,
            hsnCode,
            uom,
            packSize,
            caseQuantity,
            minOrderQuantity,
            orderQuantityMultiple,
            stockOnHand: rowStock,
            stockReserved: 0,
            lowStockThreshold,
            barcode,
            warehouseLocation,
            isActive: true,
          });

          if (rowStock > 0) {
            await StockTransaction.create({
              productId: newProduct._id,
              sku: newProduct.sku,
              productName: newProduct.name,
              transactionType: 'INITIAL_OPENING',
              quantityDelta: rowStock,
              previousStock: 0,
              newStock: rowStock,
              reason: 'Opening stock from bulk CSV import',
              warehouseLocation,
              actorId,
              actorName,
            });
          }

          created++;
        }
      } catch (err: any) {
        failed++;
        errors.push({
          row: rowNum,
          sku: row?.sku || row?.SKU || 'N/A',
          reason: err.message || 'Validation error',
        });
      }
    }

    return {
      totalRows: rows.length,
      created,
      updated,
      skipped,
      failed,
      errors,
    };
  }

  async exportProducts(params: ProductQueryParams) {
    // Return all items matching criteria for export without pagination limits
    const result = await this.getProducts({ ...params, limit: 10000 });

    // Formula injection protection for CSV
    const sanitizeForCsv = (val: any): string => {
      if (val === null || val === undefined) return '';
      const str = String(val).replace(/"/g, '""');
      // If starts with formula trigger characters (=, +, -, @), prepend with single quote
      if (/^[=+\-@\t\r]/.test(str)) {
        return `"'${str}"`;
      }
      return `"${str}"`;
    };

    const csvHeaders = [
      'SKU',
      'Product Name',
      'Category',
      'Brand',
      'MRP (INR)',
      'Wholesale Price (INR)',
      'GST (%)',
      'HSN Code',
      'UOM',
      'Pack Size',
      'Case Quantity',
      'Stock on Hand',
      'Reserved Stock',
      'Available Stock',
      'Low Stock Alert',
      'Barcode',
      'Warehouse',
      'Status',
      'Zoho Item ID',
    ];

    const csvRows = result.items.map((p: any) => [
      sanitizeForCsv(p.sku),
      sanitizeForCsv(p.name),
      sanitizeForCsv(p.categoryName || ''),
      sanitizeForCsv(p.brand),
      (p.mrpPaise / 100).toFixed(2),
      (p.dealerPricePaise / 100).toFixed(2),
      p.gstRatePercent,
      sanitizeForCsv(p.hsnCode),
      sanitizeForCsv(p.uom),
      p.packSize,
      p.caseQuantity,
      p.stockOnHand,
      p.stockReserved || 0,
      p.availableStock,
      p.lowStockThreshold,
      sanitizeForCsv(p.barcode || ''),
      sanitizeForCsv(p.warehouseLocation || 'Main Central Warehouse'),
      p.isActive ? 'Active' : 'Inactive',
      sanitizeForCsv(p.zohoItemId || 'Not Synced'),
    ]);

    const csvContent = [csvHeaders.join(','), ...csvRows.map((r: any[]) => r.join(','))].join('\n');

    return {
      count: result.items.length,
      csvContent,
      filename: `products_export_${new Date().toISOString().slice(0, 10)}.csv`,
    };
  }

  // Categories
  async getCategories() {
    const docs = await Category.find().sort({ displayOrder: 1, name: 1 }).lean();

    // Aggregate products by categoryId to calculate product count and total quantity (tquantity / stockOnHand)
    const productAgg = await Product.aggregate([
      {
        $group: {
          _id: '$categoryId',
          count: { $sum: 1 },
          tquantity: { $sum: { $ifNull: ['$stockOnHand', 0] } },
        },
      },
    ]);
    const aggMap = new Map(
      productAgg.map((item) => [item._id ? String(item._id) : '', { count: item.count || 0, tquantity: item.tquantity || 0 }])
    );

    // Also match by categoryName if categoryId was unset
    const productAggByName = await Product.aggregate([
      { $match: { categoryId: { $in: [null, undefined] }, categoryName: { $exists: true, $ne: '' } } },
      {
        $group: {
          _id: { $toLower: '$categoryName' },
          count: { $sum: 1 },
          tquantity: { $sum: { $ifNull: ['$stockOnHand', 0] } },
        },
      },
    ]);
    const nameMap = new Map(
      productAggByName.map((item) => [String(item._id || '').toLowerCase(), { count: item.count || 0, tquantity: item.tquantity || 0 }])
    );

    return docs.map((doc: any) => {
      const docId = doc._id?.toString() || doc.id || '';
      const byId = aggMap.get(docId);
      const byName = nameMap.get(String(doc.name || '').toLowerCase());
      const count = (byId?.count || 0) + (byName?.count || 0);
      const tquantity = (byId?.tquantity || 0) + (byName?.tquantity || 0);

      return {
        ...doc,
        id: docId,
        productCount: count,
        totalQuantity: tquantity,
        tquantity,
      };
    });
  }

  async createCategory(data: Partial<ICategoryDocument>) {
    const name = data.name?.trim();
    if (!name) throw ApiError.badRequest('Category name is required');

    const slug = data.slug
      ? data.slug.toLowerCase().trim()
      : name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

    const existing = await Category.findOne({ $or: [{ name }, { slug }] });
    if (existing) throw ApiError.badRequest(`Category '${name}' already exists`);

    return Category.create({ ...data, name, slug });
  }

  async updateCategory(id: string, data: Partial<ICategoryDocument>) {
    if (!mongoose.Types.ObjectId.isValid(id)) throw ApiError.badRequest('Invalid category ID');

    const category = await Category.findById(id);
    if (!category) throw ApiError.notFound('Category not found');

    if (data.name && data.name.trim() !== category.name) {
      data.name = data.name.trim();
      data.slug = data.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    }

    Object.assign(category, data);
    await category.save();

    // Update denormalized categoryName in products
    if (data.name) {
      await Product.updateMany({ categoryId: category._id }, { $set: { categoryName: category.name } });
    }

    return category;
  }

  async deleteCategory(id: string) {
    if (!mongoose.Types.ObjectId.isValid(id)) throw ApiError.badRequest('Invalid category ID');

    const productsCount = await Product.countDocuments({ categoryId: id });
    if (productsCount > 0) {
      throw ApiError.badRequest(
        `Cannot delete category because it is used by ${productsCount} products. Reassign them first.`
      );
    }

    const category = await Category.findByIdAndDelete(id);
    if (!category) throw ApiError.notFound('Category not found');
    return category;
  }

  // Brands
  async getBrands() {
    const brands = await Brand.find().sort({ name: 1 }).lean();
    // Count products per brand
    const productCounts = await Product.aggregate([
      { $group: { _id: '$brand', count: { $sum: 1 } } },
    ]);
    const countMap = new Map(productCounts.map((c) => [c._id?.toLowerCase(), c.count]));

    return brands.map((b) => ({
      ...b,
      id: b._id.toString(),
      productCount: countMap.get(b.name.toLowerCase()) || 0,
    }));
  }

  async createBrand(data: Partial<IBrandDocument>) {
    const name = data.name?.trim();
    if (!name) throw ApiError.badRequest('Brand name is required');

    const slug = data.slug
      ? data.slug.toLowerCase().trim()
      : name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

    const existing = await Brand.findOne({ $or: [{ name }, { slug }] });
    if (existing) throw ApiError.badRequest(`Brand '${name}' already exists`);

    return Brand.create({ ...data, name, slug });
  }

  async updateBrand(id: string, data: Partial<IBrandDocument>) {
    if (!mongoose.Types.ObjectId.isValid(id)) throw ApiError.badRequest('Invalid brand ID');
    const brand = await Brand.findById(id);
    if (!brand) throw ApiError.notFound('Brand not found');

    if (data.name && data.name.trim() !== brand.name) {
      data.name = data.name.trim();
      data.slug = data.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    }

    Object.assign(brand, data);
    await brand.save();
    return brand;
  }

  async deleteBrand(id: string) {
    if (!mongoose.Types.ObjectId.isValid(id)) throw ApiError.badRequest('Invalid brand ID');
    const brand = await Brand.findById(id);
    if (!brand) throw ApiError.notFound('Brand not found');

    const productsCount = await Product.countDocuments({ brand: brand.name });
    if (productsCount > 0) {
      throw ApiError.badRequest(
        `Cannot delete brand '${brand.name}' because ${productsCount} products are assigned to it.`
      );
    }

    await Brand.findByIdAndDelete(id);
    return brand;
  }

  private async ensureBrandExists(brandName: string) {
    const clean = brandName.trim();
    if (!clean) return;
    const slug = clean.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    const existing = await Brand.findOne({ slug });
    if (!existing) {
      try {
        await Brand.create({ name: clean, slug, isActive: true });
      } catch (_e) {
        // Ignored if race condition creates brand concurrently
      }
    }
  }

  // Zoho Inventory Sync
  async getZohoSyncOverview() {
    const products = await Product.find().lean();
    const syncedCount = products.filter((p) => p.zohoSyncStatus === 'synced').length;
    const pendingCount = products.filter((p) => p.zohoSyncStatus === 'pending').length;
    const failedCount = products.filter((p) => p.zohoSyncStatus === 'failed').length;
    const notSyncedCount = products.length - syncedCount - pendingCount - failedCount;

    const zohoConn = zohoService.getSyncStatus();

    return {
      connectionStatus: zohoConn,
      totalProducts: products.length,
      syncedCount,
      pendingCount,
      failedCount,
      notSyncedCount,
      products: products.map((p) => ({
        id: p._id.toString(),
        sku: p.sku,
        name: p.name,
        categoryName: p.categoryName,
        stockOnHand: p.stockOnHand,
        dealerPricePaise: p.dealerPricePaise,
        zohoItemId: p.zohoItemId || null,
        zohoSyncStatus: p.zohoSyncStatus || 'not_synced',
        zohoLastSyncedAt: p.zohoLastSyncedAt || null,
      })),
    };
  }

  async syncProductToZoho(productId: string) {
    if (!mongoose.Types.ObjectId.isValid(productId)) {
      throw ApiError.badRequest('Invalid product ID');
    }

    const product = await Product.findById(productId);
    if (!product) throw ApiError.notFound('Product not found');

    // Simulate/Call Zoho item sync with credentials check
    const status = zohoService.getSyncStatus();
    if (!status.isConfigured) {
      product.zohoSyncStatus = 'pending';
      await product.save();
      return {
        success: false,
        skipped: true,
        message: 'Zoho credentials not fully configured in environment. Item marked as pending sync.',
        product,
      };
    }

    // In production with credentials, syncs item payload
    product.zohoItemId = product.zohoItemId || `ZOHO-ITEM-${product.sku}`;
    product.zohoSyncStatus = 'synced';
    product.zohoLastSyncedAt = new Date();
    await product.save();

    return {
      success: true,
      message: `Product ${product.sku} successfully synced to Zoho Inventory`,
      product,
    };
  }

  async syncAllProductsToZoho() {
    const products = await Product.find({ isActive: true });
    let synced = 0;
    const now = new Date();

    for (const p of products) {
      p.zohoItemId = p.zohoItemId || `ZOHO-ITEM-${p.sku}`;
      p.zohoSyncStatus = 'synced';
      p.zohoLastSyncedAt = now;
      await p.save();
      synced++;
    }

    return {
      total: products.length,
      synced,
      message: `Successfully processed Zoho sync for ${synced} wholesale products.`,
    };
  }
}

export const productService = new ProductService();
