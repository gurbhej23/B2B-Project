import mongoose from 'mongoose';
import {
  ProductDiscount,
  Coupon,
  CouponRedemption,
  DiscountGroup,
  IProductDiscountDocument,
  ICouponDocument,
  IDiscountGroupDocument,
} from './discount.model';
import { DiscountType, DiscountScope, CustomerType } from '@necessity/shared';
import { ApiError } from '../../utils/api-error';
import { auditLogger } from '../audit/audit.service';

export class DiscountService {
  // =========================================================================
  // PRODUCT DISCOUNTS
  // =========================================================================

  async listProductDiscounts(query: any) {
    const { search, status, page = 1, limit = 20 } = query;
    const filter: any = {};

    if (status === 'active') {
      filter.isActive = true;
    } else if (status === 'inactive') {
      filter.isActive = false;
    }

    if (search && search.trim()) {
      filter.name = { $regex: search.trim(), $options: 'i' };
    }

    const skip = (Number(page) - 1) * Number(limit);
    const [items, total] = await Promise.all([
      ProductDiscount.find(filter)
        .populate('applicableProductIds', 'name sku dealerPricePaise')
        .populate('applicableCategoryIds', 'name')
        .sort({ priority: -1, createdAt: -1 })
        .skip(skip)
        .limit(Number(limit)),
      ProductDiscount.countDocuments(filter),
    ]);

    return {
      items,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        totalPages: Math.ceil(total / Number(limit)),
      },
    };
  }

  async getProductDiscountById(id: string): Promise<IProductDiscountDocument> {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw ApiError.badRequest('Invalid product discount ID');
    }
    const discount = await ProductDiscount.findById(id)
      .populate('applicableProductIds', 'name sku dealerPricePaise')
      .populate('applicableCategoryIds', 'name');
    if (!discount) {
      throw ApiError.notFound('Product discount not found');
    }
    return discount;
  }

  async createProductDiscount(data: any, actorId: string): Promise<IProductDiscountDocument> {
    const startDate = new Date(data.startDate);
    const endDate = new Date(data.endDate);

    if (endDate <= startDate) {
      throw ApiError.badRequest('End date must be strictly after start date');
    }

    if (data.discountType === DiscountType.PERCENTAGE && (data.discountValue <= 0 || data.discountValue > 100)) {
      throw ApiError.badRequest('Percentage discount must be between 1 and 100');
    }

    if (data.discountType === DiscountType.FIXED_AMOUNT && data.discountValue <= 0) {
      throw ApiError.badRequest('Fixed discount value in paise must be positive');
    }

    const discount = await ProductDiscount.create({
      name: data.name.trim(),
      discountType: data.discountType,
      discountValue: data.discountValue,
      scope: data.scope || DiscountScope.ALL_PRODUCTS,
      applicableProductIds: data.applicableProductIds || [],
      applicableCategoryIds: data.applicableCategoryIds || [],
      eligibleCustomerTypes: data.eligibleCustomerTypes || [],
      minQuantity: data.minQuantity || 1,
      maxDiscountPaise: data.maxDiscountPaise,
      startDate,
      endDate,
      isActive: data.isActive !== false,
      priority: data.priority || 1,
    });

    await auditLogger.logAction({
      actorId,
      action: 'PRODUCT_DISCOUNT_CREATED',
      targetResource: 'ProductDiscount',
      targetId: discount.id,
      details: { name: discount.name, discountType: discount.discountType, discountValue: discount.discountValue },
    });

    return discount;
  }

  async updateProductDiscount(id: string, data: any, actorId: string): Promise<IProductDiscountDocument> {
    const discount = await this.getProductDiscountById(id);

    if (data.startDate && data.endDate) {
      const s = new Date(data.startDate);
      const e = new Date(data.endDate);
      if (e <= s) throw ApiError.badRequest('End date must be strictly after start date');
      discount.startDate = s;
      discount.endDate = e;
    } else if (data.startDate) {
      const s = new Date(data.startDate);
      if (discount.endDate <= s) throw ApiError.badRequest('Start date must be before existing end date');
      discount.startDate = s;
    } else if (data.endDate) {
      const e = new Date(data.endDate);
      if (e <= discount.startDate) throw ApiError.badRequest('End date must be after existing start date');
      discount.endDate = e;
    }

    if (data.name !== undefined) discount.name = data.name.trim();
    if (data.discountType !== undefined) discount.discountType = data.discountType;
    if (data.discountValue !== undefined) {
      if (discount.discountType === DiscountType.PERCENTAGE && (data.discountValue <= 0 || data.discountValue > 100)) {
        throw ApiError.badRequest('Percentage discount must be between 1 and 100');
      }
      if (discount.discountType === DiscountType.FIXED_AMOUNT && data.discountValue <= 0) {
        throw ApiError.badRequest('Fixed discount value in paise must be positive');
      }
      discount.discountValue = data.discountValue;
    }
    if (data.scope !== undefined) discount.scope = data.scope;
    if (data.applicableProductIds !== undefined) discount.applicableProductIds = data.applicableProductIds;
    if (data.applicableCategoryIds !== undefined) discount.applicableCategoryIds = data.applicableCategoryIds;
    if (data.eligibleCustomerTypes !== undefined) discount.eligibleCustomerTypes = data.eligibleCustomerTypes;
    if (data.minQuantity !== undefined) discount.minQuantity = data.minQuantity;
    if (data.maxDiscountPaise !== undefined) discount.maxDiscountPaise = data.maxDiscountPaise;
    if (data.isActive !== undefined) discount.isActive = Boolean(data.isActive);
    if (data.priority !== undefined) discount.priority = data.priority;

    await discount.save();

    await auditLogger.logAction({
      actorId,
      action: 'PRODUCT_DISCOUNT_UPDATED',
      targetResource: 'ProductDiscount',
      targetId: discount.id,
      details: { name: discount.name },
    });

    return discount;
  }

  async toggleProductDiscountStatus(id: string, isActive: boolean, actorId: string): Promise<IProductDiscountDocument> {
    const discount = await this.getProductDiscountById(id);
    discount.isActive = Boolean(isActive);
    await discount.save();

    await auditLogger.logAction({
      actorId,
      action: isActive ? 'PRODUCT_DISCOUNT_ACTIVATED' : 'PRODUCT_DISCOUNT_DEACTIVATED',
      targetResource: 'ProductDiscount',
      targetId: discount.id,
      details: { name: discount.name, isActive },
    });

    return discount;
  }

  async deleteProductDiscount(id: string, actorId: string): Promise<{ success: boolean; message: string }> {
    const discount = await this.getProductDiscountById(id);
    await discount.deleteOne();

    await auditLogger.logAction({
      actorId,
      action: 'PRODUCT_DISCOUNT_DELETED',
      targetResource: 'ProductDiscount',
      targetId: id,
      details: { name: discount.name },
    });

    return { success: true, message: 'Product discount deleted successfully' };
  }

  /**
   * Resolves the best applicable product discount for a given product line item.
   */
  async resolveProductDiscount(
    product: any,
    quantity: number,
    unitPricePaise: number,
    customerType?: string,
    pricingGroupId?: string,
    discountGroupId?: string
  ): Promise<{
    discount: IProductDiscountDocument | null;
    unitDiscountPaise: number;
    discountName?: string;
    discountType?: DiscountType;
    discountValue?: number;
  }> {
    const now = new Date();
    const discounts = await ProductDiscount.find({
      isActive: true,
      startDate: { $lte: now },
      endDate: { $gte: now },
    }).sort({ priority: -1, discountValue: -1 });

    const prodIdStr = product._id?.toString() || product.id?.toString();
    const catIdStr = product.categoryId?._id?.toString() || product.categoryId?.toString();

    let bestDiscount: IProductDiscountDocument | null = null;
    let maxUnitDiscount = 0;

    for (const d of discounts) {
      // 1. Min quantity check
      if (d.minQuantity && quantity < d.minQuantity) {
        continue;
      }

      // 2. Customer type check
      if (
        Array.isArray(d.eligibleCustomerTypes) &&
        d.eligibleCustomerTypes.length > 0 &&
        (!customerType || !d.eligibleCustomerTypes.some((t) => t.toLowerCase() === customerType.toLowerCase()))
      ) {
        continue;
      }

      // 2b. Pricing Group check
      if (
        Array.isArray(d.eligiblePricingGroupIds) &&
        d.eligiblePricingGroupIds.length > 0 &&
        (!pricingGroupId || !d.eligiblePricingGroupIds.some((gId) => gId.toString() === pricingGroupId.toString()))
      ) {
        continue;
      }

      // 2c. Discount Group check
      if (
        Array.isArray(d.eligibleDiscountGroupIds) &&
        d.eligibleDiscountGroupIds.length > 0 &&
        (!discountGroupId || !d.eligibleDiscountGroupIds.some((gId) => gId.toString() === discountGroupId.toString()))
      ) {
        continue;
      }

      // 3. Scope check
      let matchesScope = false;
      if (d.scope === DiscountScope.ALL_PRODUCTS) {
        matchesScope = true;
      } else if (d.scope === DiscountScope.PRODUCTS) {
        matchesScope = Array.isArray(d.applicableProductIds) &&
          d.applicableProductIds.some((pId) => pId.toString() === prodIdStr);
      } else if (d.scope === DiscountScope.CATEGORIES) {
        matchesScope = Array.isArray(d.applicableCategoryIds) &&
          Boolean(catIdStr) &&
          d.applicableCategoryIds.some((cId) => cId.toString() === catIdStr);
      }

      if (!matchesScope) {
        continue;
      }

      // 4. Calculate unit discount
      let unitDiscount = 0;
      if (d.discountType === DiscountType.PERCENTAGE) {
        unitDiscount = Math.round(unitPricePaise * (d.discountValue / 100));
      } else {
        unitDiscount = Math.min(d.discountValue, unitPricePaise);
      }

      if (d.maxDiscountPaise && unitDiscount > d.maxDiscountPaise) {
        unitDiscount = d.maxDiscountPaise;
      }

      if (unitDiscount > maxUnitDiscount || (!bestDiscount && unitDiscount > 0)) {
        maxUnitDiscount = unitDiscount;
        bestDiscount = d;
      }
    }

    if (!bestDiscount || maxUnitDiscount <= 0) {
      return { discount: null, unitDiscountPaise: 0 };
    }

    return {
      discount: bestDiscount,
      unitDiscountPaise: maxUnitDiscount,
      discountName: bestDiscount.name,
      discountType: bestDiscount.discountType,
      discountValue: bestDiscount.discountValue,
    };
  }

  // =========================================================================
  // COUPONS
  // =========================================================================

  async listCoupons(query: any) {
    const { search, status, page = 1, limit = 20 } = query;
    const filter: any = {};

    if (status === 'active') {
      filter.isActive = true;
    } else if (status === 'inactive') {
      filter.isActive = false;
    }

    if (search && search.trim()) {
      filter.$or = [
        { code: { $regex: search.trim().toUpperCase(), $options: 'i' } },
        { description: { $regex: search.trim(), $options: 'i' } },
      ];
    }

    const skip = (Number(page) - 1) * Number(limit);
    const [items, total] = await Promise.all([
      Coupon.find(filter)
        .populate('eligibleRetailerIds', 'businessName contactPerson phone')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit)),
      Coupon.countDocuments(filter),
    ]);

    return {
      items,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        totalPages: Math.ceil(total / Number(limit)),
      },
    };
  }

  async getCouponById(id: string): Promise<ICouponDocument> {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw ApiError.badRequest('Invalid coupon ID');
    }
    const coupon = await Coupon.findById(id).populate(
      'eligibleRetailerIds',
      'businessName contactPerson phone'
    );
    if (!coupon) {
      throw ApiError.notFound('Coupon not found');
    }
    return coupon;
  }

  async createCoupon(data: any, actorId: string): Promise<ICouponDocument> {
    const code = data.code.trim().toUpperCase();
    const existing = await Coupon.findOne({ code });
    if (existing) {
      throw ApiError.badRequest(`Coupon with code '${code}' already exists`);
    }

    const startDate = new Date(data.startDate);
    const endDate = new Date(data.endDate);

    if (endDate <= startDate) {
      throw ApiError.badRequest('End date must be strictly after start date');
    }

    if (data.discountType === DiscountType.PERCENTAGE && (data.discountValue <= 0 || data.discountValue > 100)) {
      throw ApiError.badRequest('Percentage discount must be between 1 and 100');
    }

    if (data.discountType === DiscountType.FIXED_AMOUNT && data.discountValue <= 0) {
      throw ApiError.badRequest('Fixed discount value in paise must be positive');
    }

    const coupon = await Coupon.create({
      code,
      description: data.description?.trim(),
      discountType: data.discountType,
      discountValue: data.discountValue,
      minOrderValuePaise: data.minOrderValuePaise || 0,
      maxDiscountPaise: data.maxDiscountPaise,
      eligibleCustomerTypes: data.eligibleCustomerTypes || [],
      eligibleRetailerIds: data.eligibleRetailerIds || [],
      startDate,
      endDate,
      totalUsageLimit: data.totalUsageLimit !== undefined ? data.totalUsageLimit : null,
      perCustomerLimit: data.perCustomerLimit || 1,
      usageCount: 0,
      isActive: data.isActive !== false,
    });

    await auditLogger.logAction({
      actorId,
      action: 'COUPON_CREATED',
      targetResource: 'Coupon',
      targetId: coupon.id,
      details: { code: coupon.code, discountType: coupon.discountType, discountValue: coupon.discountValue },
    });

    return coupon;
  }

  async updateCoupon(id: string, data: any, actorId: string): Promise<ICouponDocument> {
    const coupon = await this.getCouponById(id);

    if (data.code && data.code.trim().toUpperCase() !== coupon.code) {
      const newCode = data.code.trim().toUpperCase();
      const existing = await Coupon.findOne({ code: newCode });
      if (existing) {
        throw ApiError.badRequest(`Coupon with code '${newCode}' already exists`);
      }
      coupon.code = newCode;
    }

    if (data.startDate && data.endDate) {
      const s = new Date(data.startDate);
      const e = new Date(data.endDate);
      if (e <= s) throw ApiError.badRequest('End date must be strictly after start date');
      coupon.startDate = s;
      coupon.endDate = e;
    } else if (data.startDate) {
      const s = new Date(data.startDate);
      if (coupon.endDate <= s) throw ApiError.badRequest('Start date must be before existing end date');
      coupon.startDate = s;
    } else if (data.endDate) {
      const e = new Date(data.endDate);
      if (e <= coupon.startDate) throw ApiError.badRequest('End date must be after existing start date');
      coupon.endDate = e;
    }

    if (data.description !== undefined) coupon.description = data.description?.trim();
    if (data.discountType !== undefined) coupon.discountType = data.discountType;
    if (data.discountValue !== undefined) {
      if (coupon.discountType === DiscountType.PERCENTAGE && (data.discountValue <= 0 || data.discountValue > 100)) {
        throw ApiError.badRequest('Percentage discount must be between 1 and 100');
      }
      if (coupon.discountType === DiscountType.FIXED_AMOUNT && data.discountValue <= 0) {
        throw ApiError.badRequest('Fixed discount value in paise must be positive');
      }
      coupon.discountValue = data.discountValue;
    }
    if (data.minOrderValuePaise !== undefined) coupon.minOrderValuePaise = data.minOrderValuePaise;
    if (data.maxDiscountPaise !== undefined) coupon.maxDiscountPaise = data.maxDiscountPaise;
    if (data.eligibleCustomerTypes !== undefined) coupon.eligibleCustomerTypes = data.eligibleCustomerTypes;
    if (data.eligibleRetailerIds !== undefined) coupon.eligibleRetailerIds = data.eligibleRetailerIds;
    if (data.totalUsageLimit !== undefined) coupon.totalUsageLimit = data.totalUsageLimit;
    if (data.perCustomerLimit !== undefined) coupon.perCustomerLimit = data.perCustomerLimit;
    if (data.isActive !== undefined) coupon.isActive = Boolean(data.isActive);

    await coupon.save();

    await auditLogger.logAction({
      actorId,
      action: 'COUPON_UPDATED',
      targetResource: 'Coupon',
      targetId: coupon.id,
      details: { code: coupon.code },
    });

    return coupon;
  }

  async toggleCouponStatus(id: string, isActive: boolean, actorId: string): Promise<ICouponDocument> {
    const coupon = await this.getCouponById(id);
    coupon.isActive = Boolean(isActive);
    await coupon.save();

    await auditLogger.logAction({
      actorId,
      action: isActive ? 'COUPON_ACTIVATED' : 'COUPON_DEACTIVATED',
      targetResource: 'Coupon',
      targetId: coupon.id,
      details: { code: coupon.code, isActive },
    });

    return coupon;
  }

  async deleteCoupon(id: string, actorId: string): Promise<{ success: boolean; message: string }> {
    const coupon = await this.getCouponById(id);
    await coupon.deleteOne();

    await auditLogger.logAction({
      actorId,
      action: 'COUPON_DELETED',
      targetResource: 'Coupon',
      targetId: id,
      details: { code: coupon.code },
    });

    return { success: true, message: 'Coupon deleted successfully' };
  }

  /**
   * Validates a coupon code against order taxable amount, customer eligibility, and usage limits.
   */
  async validateCoupon(
    code: string,
    taxableAmountPaise: number,
    retailerId?: string,
    customerType?: string,
    pricingGroupId?: string,
    discountGroupId?: string
  ): Promise<{
    isValid: boolean;
    coupon: ICouponDocument;
    discountAmountPaise: number;
  }> {
    if (!code || !code.trim()) {
      throw ApiError.badRequest('Coupon code is required');
    }

    const cleanCode = code.trim().toUpperCase();
    const coupon = await Coupon.findOne({ code: cleanCode });

    if (!coupon) {
      throw ApiError.badRequest(`Invalid coupon code '${cleanCode}'`);
    }

    if (!coupon.isActive) {
      throw ApiError.badRequest(`Coupon code '${cleanCode}' is currently inactive`);
    }

    const now = new Date();
    if (now < coupon.startDate) {
      throw ApiError.badRequest(`Coupon code '${cleanCode}' is not active yet`);
    }

    if (now > coupon.endDate) {
      throw ApiError.badRequest(`Coupon code '${cleanCode}' has expired`);
    }

    // 1. Total usage limit check
    if (coupon.totalUsageLimit !== null && coupon.totalUsageLimit !== undefined) {
      if (coupon.usageCount >= coupon.totalUsageLimit) {
        throw ApiError.badRequest(`Coupon code '${cleanCode}' has reached its maximum overall usage limit`);
      }
    }

    // 2. Per-customer usage limit check
    if (retailerId && mongoose.Types.ObjectId.isValid(retailerId)) {
      const customerRedemptionsCount = await CouponRedemption.countDocuments({
        couponId: coupon._id,
        retailerId: new mongoose.Types.ObjectId(retailerId),
      });

      if (customerRedemptionsCount >= (coupon.perCustomerLimit || 1)) {
        throw ApiError.badRequest(
          `You have already reached the maximum usage limit (${coupon.perCustomerLimit || 1} time) for coupon '${cleanCode}'`
        );
      }
    }

    // 3. Customer Type eligibility check
    if (
      Array.isArray(coupon.eligibleCustomerTypes) &&
      coupon.eligibleCustomerTypes.length > 0
    ) {
      if (
        !customerType ||
        !coupon.eligibleCustomerTypes.some((t) => t.toLowerCase() === customerType.toLowerCase())
      ) {
        throw ApiError.badRequest(
          `Coupon code '${cleanCode}' is only available for eligible wholesale accounts (${coupon.eligibleCustomerTypes.join(', ')})`
        );
      }
    }

    // 3b. Pricing Group eligibility check
    if (
      Array.isArray(coupon.eligiblePricingGroupIds) &&
      coupon.eligiblePricingGroupIds.length > 0
    ) {
      if (
        !pricingGroupId ||
        !coupon.eligiblePricingGroupIds.some((gId) => gId.toString() === pricingGroupId.toString())
      ) {
        throw ApiError.badRequest(`This coupon is not valid for your assigned pricing tier`);
      }
    }

    // 3c. Discount Group eligibility check
    if (
      Array.isArray(coupon.eligibleDiscountGroupIds) &&
      coupon.eligibleDiscountGroupIds.length > 0
    ) {
      if (
        !discountGroupId ||
        !coupon.eligibleDiscountGroupIds.some((gId) => gId.toString() === discountGroupId.toString())
      ) {
        throw ApiError.badRequest(`This coupon is not valid for your customer discount group`);
      }
    }

    // 4. Retailer specific eligibility check
    if (
      Array.isArray(coupon.eligibleRetailerIds) &&
      coupon.eligibleRetailerIds.length > 0
    ) {
      if (
        !retailerId ||
        !coupon.eligibleRetailerIds.some((rId) => rId.toString() === retailerId.toString())
      ) {
        throw ApiError.badRequest(`This coupon is not valid for your account`);
      }
    }

    // 5. Minimum Order Value Check
    if (taxableAmountPaise < (coupon.minOrderValuePaise || 0)) {
      const minINR = (coupon.minOrderValuePaise / 100).toLocaleString('en-IN', {
        style: 'currency',
        currency: 'INR',
      });
      throw ApiError.badRequest(
        `Coupon '${cleanCode}' requires a minimum order value of ${minINR}`
      );
    }

    // 6. Calculate discount amount
    let discountAmountPaise = 0;
    if (coupon.discountType === DiscountType.PERCENTAGE) {
      discountAmountPaise = Math.round(taxableAmountPaise * (coupon.discountValue / 100));
      if (coupon.maxDiscountPaise && discountAmountPaise > coupon.maxDiscountPaise) {
        discountAmountPaise = coupon.maxDiscountPaise;
      }
    } else {
      discountAmountPaise = Math.min(coupon.discountValue, taxableAmountPaise);
    }

    // Ensure discount does not exceed taxable amount
    discountAmountPaise = Math.min(discountAmountPaise, taxableAmountPaise);

    return {
      isValid: true,
      coupon,
      discountAmountPaise,
    };
  }

  /**
   * Atomically records coupon redemption during order confirmation.
   * Concurrency-safe: uses findOneAndUpdate with condition usageCount < totalUsageLimit.
   */
  async recordCouponRedemption(
    couponId: string,
    retailerId: string,
    retailerName: string,
    orderId: string,
    orderNumber: string,
    discountAmountPaise: number
  ): Promise<void> {
    const couponDoc = await Coupon.findById(couponId);
    if (!couponDoc) return;

    const filter: any = { _id: couponDoc._id, isActive: true };
    if (couponDoc.totalUsageLimit !== null && couponDoc.totalUsageLimit !== undefined) {
      filter.usageCount = { $lt: couponDoc.totalUsageLimit };
    }

    const updatedCoupon = await Coupon.findOneAndUpdate(
      filter,
      { $inc: { usageCount: 1 } },
      { new: true }
    );

    if (!updatedCoupon && couponDoc.totalUsageLimit !== null) {
      throw ApiError.badRequest('Coupon total usage limit reached');
    }

    await CouponRedemption.create({
      couponId: couponDoc._id,
      couponCode: couponDoc.code,
      retailerId: new mongoose.Types.ObjectId(retailerId),
      retailerName,
      orderId: new mongoose.Types.ObjectId(orderId),
      orderNumber,
      discountAmountPaise,
      redeemedAt: new Date(),
    });
  }

  /**
   * Retrieves redemption history for a specific coupon or all coupons.
   */
  async listRedemptions(couponId?: string, query: any = {}) {
    const { page = 1, limit = 20 } = query;
    const filter: any = {};

    if (couponId && mongoose.Types.ObjectId.isValid(couponId)) {
      filter.couponId = new mongoose.Types.ObjectId(couponId);
    }

    const skip = (Number(page) - 1) * Number(limit);
    const [items, total] = await Promise.all([
      CouponRedemption.find(filter)
        .populate('retailerId', 'businessName contactPerson phone')
        .sort({ redeemedAt: -1 })
        .skip(skip)
        .limit(Number(limit)),
      CouponRedemption.countDocuments(filter),
    ]);

    return {
      items,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        totalPages: Math.ceil(total / Number(limit)),
      },
    };
  }

  // =========================================================================
  // DISCOUNT GROUPS
  // =========================================================================

  async ensureDefaultDiscountGroups(): Promise<void> {
    const defaultGroups = [
      {
        name: 'Standard Retailer Discount Group',
        code: 'retailer-standard',
        description: 'Standard discount tier for approved retail shops',
        discountPercent: 0,
        applicableCustomerTypes: [CustomerType.RETAILER, 'retailer', 'new'],
        isActive: true,
      },
      {
        name: 'Bulk Wholesaler Discount Group',
        code: 'wholesaler-bulk',
        description: 'Special additional incentives for high-volume wholesale dealers',
        discountPercent: 5,
        applicableCustomerTypes: [CustomerType.WHOLESALER, 'wholesaler', 'old'],
        isActive: true,
      },
      {
        name: 'Exclusive Distributor Discount Group',
        code: 'distributor-exclusive',
        description: 'Maximum margin allowance for state/regional distributors',
        discountPercent: 10,
        applicableCustomerTypes: [CustomerType.DISTRIBUTOR, 'distributor'],
        isActive: true,
      },
    ];

    for (const group of defaultGroups) {
      await DiscountGroup.findOneAndUpdate(
        { code: group.code },
        { $setOnInsert: group },
        { upsert: true, new: true }
      );
    }
  }

  async listDiscountGroups(query: any = {}) {
    await this.ensureDefaultDiscountGroups();
    const filter: any = {};
    if (typeof query.isActive === 'boolean') {
      filter.isActive = query.isActive;
    }
    if (query.customerType) {
      filter.applicableCustomerTypes = String(query.customerType).toLowerCase();
    }
    return DiscountGroup.find(filter).sort({ createdAt: 1 });
  }

  async getDiscountGroupById(id: string) {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw ApiError.badRequest('Invalid discount group ID');
    }
    const group = await DiscountGroup.findById(id);
    if (!group) {
      throw ApiError.notFound('Discount group not found');
    }
    return group;
  }

  async createDiscountGroup(data: any) {
    const cleanCode = data.code.trim().toLowerCase();
    const existing = await DiscountGroup.findOne({ code: cleanCode });
    if (existing) {
      throw ApiError.badRequest(`Discount group with code '${cleanCode}' already exists`);
    }
    return DiscountGroup.create({
      ...data,
      code: cleanCode,
      applicableCustomerTypes: data.applicableCustomerTypes || [CustomerType.RETAILER],
      isActive: data.isActive !== false,
    });
  }

  async updateDiscountGroup(id: string, data: any) {
    const group = await this.getDiscountGroupById(id);
    if (data.code && data.code.trim().toLowerCase() !== group.code) {
      const cleanCode = data.code.trim().toLowerCase();
      const existing = await DiscountGroup.findOne({ code: cleanCode, _id: { $ne: group._id } });
      if (existing) {
        throw ApiError.badRequest(`Discount group with code '${cleanCode}' already exists`);
      }
      group.code = cleanCode;
    }
    if (data.name !== undefined) group.name = data.name;
    if (data.description !== undefined) group.description = data.description;
    if (data.discountPercent !== undefined) group.discountPercent = data.discountPercent;
    if (data.applicableCustomerTypes !== undefined) group.applicableCustomerTypes = data.applicableCustomerTypes;
    if (data.isActive !== undefined) group.isActive = data.isActive;
    return group.save();
  }

  async deleteDiscountGroup(id: string) {
    await this.getDiscountGroupById(id);
    await DiscountGroup.findByIdAndDelete(id);
    return { success: true, message: 'Discount group deleted successfully' };
  }
}

export const discountService = new DiscountService();
