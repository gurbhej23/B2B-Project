import mongoose from 'mongoose';
import { PricingGroup, ProductPricingRule, IPricingGroupDocument, IProductPricingRuleDocument } from './pricing.model';
import { Product } from '../products/product.model';
import { ApiError } from '../../utils/api-error';
import { CustomerType, resolveTierPrice, validateTierPricing } from '@necessity/shared';

export interface ResolvePriceParams {
  productId: string;
  variantId?: string;
  quantity: number;
  retailerId?: string;
  customerType?: string;
  pricingGroupId?: string;
  productDoc?: any;
}

export interface ResolvedPriceResult {
  unitPricePaise: number;
  baseUnitPricePaise: number;
  appliedRuleSource: 'customer_override' | 'pricing_group' | 'customer_type' | 'product_default';
  appliedTier?: { minQuantity: number; maxQuantity?: number; unitPricePaise: number };
  effectiveMoq: number;
  eligibleTiers: Array<{ minQuantity: number; maxQuantity?: number; unitPricePaise: number }>;
}

export class PricingService {
  /**
   * Ensure default system pricing groups exist (Retail, Wholesale, Distributor)
   */
  async ensureDefaultPricingGroups(): Promise<void> {
    const defaultGroups = [
      {
        name: 'Retail Pricing Group',
        code: 'retail',
        description: 'Standard wholesale tier for independent retail shops and dealers',
        applicableCustomerTypes: [CustomerType.RETAILER, 'new', 'retailer'],
        isDefault: true,
        isActive: true,
      },
      {
        name: 'Wholesale Tier Pricing Group',
        code: 'wholesale',
        description: 'Bulk wholesale pricing with quantity-based slab discounts',
        applicableCustomerTypes: [CustomerType.WHOLESALER, 'old', 'wholesaler'],
        isDefault: true,
        isActive: true,
      },
      {
        name: 'Distributor Contract Pricing Group',
        code: 'distributor',
        description: 'Exclusive regional distributor contract pricing with high MOQs',
        applicableCustomerTypes: [CustomerType.DISTRIBUTOR, 'distributor'],
        isDefault: true,
        isActive: true,
      },
    ];

    for (const group of defaultGroups) {
      await PricingGroup.findOneAndUpdate(
        { code: group.code },
        { $setOnInsert: group },
        { upsert: true, new: true }
      );
    }
  }

  // ==========================================
  // PRICING GROUPS CRUD
  // ==========================================

  async getPricingGroups(filter: { isActive?: boolean; customerType?: string } = {}) {
    await this.ensureDefaultPricingGroups();
    const query: any = {};
    if (typeof filter.isActive === 'boolean') {
      query.isActive = filter.isActive;
    }
    if (filter.customerType) {
      query.applicableCustomerTypes = filter.customerType.toLowerCase();
    }
    return PricingGroup.find(query).sort({ isDefault: -1, createdAt: 1 });
  }

  async getPricingGroupById(id: string) {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw ApiError.badRequest('Invalid pricing group ID');
    }
    const group = await PricingGroup.findById(id);
    if (!group) {
      throw ApiError.notFound('Pricing group not found');
    }
    return group;
  }

  async createPricingGroup(data: {
    name: string;
    code: string;
    description?: string;
    applicableCustomerTypes?: string[];
    isDefault?: boolean;
    isActive?: boolean;
  }) {
    const cleanCode = data.code.trim().toLowerCase();
    const existing = await PricingGroup.findOne({ code: cleanCode });
    if (existing) {
      throw ApiError.badRequest(`A pricing group with code '${cleanCode}' already exists`);
    }

    const group = new PricingGroup({
      ...data,
      code: cleanCode,
      applicableCustomerTypes: data.applicableCustomerTypes || [CustomerType.RETAILER],
      isDefault: data.isDefault ?? false,
      isActive: data.isActive ?? true,
    });
    return group.save();
  }

  async updatePricingGroup(id: string, data: Partial<{
    name: string;
    code: string;
    description?: string;
    applicableCustomerTypes?: string[];
    isDefault?: boolean;
    isActive?: boolean;
  }>) {
    const group = await this.getPricingGroupById(id);
    if (data.code && data.code.trim().toLowerCase() !== group.code) {
      const cleanCode = data.code.trim().toLowerCase();
      const existing = await PricingGroup.findOne({ code: cleanCode, _id: { $ne: group._id } });
      if (existing) {
        throw ApiError.badRequest(`A pricing group with code '${cleanCode}' already exists`);
      }
      group.code = cleanCode;
    }

    if (data.name !== undefined) group.name = data.name;
    if (data.description !== undefined) group.description = data.description;
    if (data.applicableCustomerTypes !== undefined) group.applicableCustomerTypes = data.applicableCustomerTypes;
    if (data.isDefault !== undefined) group.isDefault = data.isDefault;
    if (data.isActive !== undefined) group.isActive = data.isActive;

    return group.save();
  }

  async deletePricingGroup(id: string) {
    const group = await this.getPricingGroupById(id);
    // Disallow deleting system default groups
    if (group.isDefault && ['retail', 'wholesale', 'distributor'].includes(group.code)) {
      throw ApiError.badRequest('Cannot delete default system pricing group');
    }
    // Delete associated rules
    await ProductPricingRule.deleteMany({ pricingGroupId: group._id });
    await PricingGroup.findByIdAndDelete(group._id);
    return { success: true, message: 'Pricing group deleted successfully' };
  }

  // ==========================================
  // PRODUCT PRICING RULES CRUD
  // ==========================================

  async getPricingRules(filter: {
    productId?: string;
    pricingGroupId?: string;
    retailerId?: string;
    customerType?: string;
    isActive?: boolean;
  } = {}) {
    const query: any = {};
    if (filter.productId && mongoose.Types.ObjectId.isValid(filter.productId)) {
      query.productId = new mongoose.Types.ObjectId(filter.productId);
    }
    if (filter.pricingGroupId && mongoose.Types.ObjectId.isValid(filter.pricingGroupId)) {
      query.pricingGroupId = new mongoose.Types.ObjectId(filter.pricingGroupId);
    }
    if (filter.retailerId && mongoose.Types.ObjectId.isValid(filter.retailerId)) {
      query.retailerId = new mongoose.Types.ObjectId(filter.retailerId);
    }
    if (filter.customerType) {
      query.customerType = filter.customerType.toLowerCase();
    }
    if (typeof filter.isActive === 'boolean') {
      query.isActive = filter.isActive;
    }

    return ProductPricingRule.find(query)
      .populate('productId', 'name sku mrpPaise dealerPricePaise uom')
      .populate('pricingGroupId', 'name code')
      .populate('retailerId', 'businessName contactPerson phone')
      .sort({ createdAt: -1 });
  }

  async getPricingRuleById(id: string) {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw ApiError.badRequest('Invalid pricing rule ID');
    }
    const rule = await ProductPricingRule.findById(id)
      .populate('productId', 'name sku mrpPaise dealerPricePaise uom')
      .populate('pricingGroupId', 'name code')
      .populate('retailerId', 'businessName contactPerson phone');
    if (!rule) {
      throw ApiError.notFound('Pricing rule not found');
    }
    return rule;
  }

  async createPricingRule(data: {
    productId: string;
    variantId?: string;
    pricingGroupId?: string;
    retailerId?: string;
    customerType?: string;
    customPricePaise?: number;
    discountPercent?: number;
    minOrderQuantity?: number;
    tierPricing?: Array<{ minQuantity: number; maxQuantity?: number; unitPricePaise: number }>;
    isActive?: boolean;
    startDate?: Date | string | null;
    endDate?: Date | string | null;
  }) {
    if (!mongoose.Types.ObjectId.isValid(data.productId)) {
      throw ApiError.badRequest('Valid product ID is required');
    }

    const product = await Product.findById(data.productId);
    if (!product) {
      throw ApiError.notFound('Target product not found');
    }

    // Validate tier pricing if present
    if (data.tierPricing && Array.isArray(data.tierPricing) && data.tierPricing.length > 0) {
      const basePrice = data.customPricePaise || product.dealerPricePaise;
      validateTierPricing(data.tierPricing, basePrice);
    }

    const rule = new ProductPricingRule({
      ...data,
      productId: new mongoose.Types.ObjectId(data.productId),
      variantId: data.variantId && mongoose.Types.ObjectId.isValid(data.variantId) ? new mongoose.Types.ObjectId(data.variantId) : null,
      pricingGroupId: data.pricingGroupId && mongoose.Types.ObjectId.isValid(data.pricingGroupId) ? new mongoose.Types.ObjectId(data.pricingGroupId) : null,
      retailerId: data.retailerId && mongoose.Types.ObjectId.isValid(data.retailerId) ? new mongoose.Types.ObjectId(data.retailerId) : null,
      customerType: data.customerType ? data.customerType.toLowerCase() : null,
      isActive: data.isActive ?? true,
    });

    return rule.save();
  }

  async updatePricingRule(id: string, data: Partial<{
    customPricePaise?: number;
    discountPercent?: number;
    minOrderQuantity?: number;
    tierPricing?: Array<{ minQuantity: number; maxQuantity?: number; unitPricePaise: number }>;
    isActive?: boolean;
    startDate?: Date | string | null;
    endDate?: Date | string | null;
  }>) {
    const rule = await this.getPricingRuleById(id);
    const product = await Product.findById(rule.productId);

    if (data.tierPricing !== undefined) {
      if (Array.isArray(data.tierPricing) && data.tierPricing.length > 0) {
        const basePrice = data.customPricePaise || rule.customPricePaise || product?.dealerPricePaise || 0;
        validateTierPricing(data.tierPricing, basePrice);
      }
      rule.tierPricing = data.tierPricing;
    }

    if (data.customPricePaise !== undefined) rule.customPricePaise = data.customPricePaise;
    if (data.discountPercent !== undefined) rule.discountPercent = data.discountPercent;
    if (data.minOrderQuantity !== undefined) rule.minOrderQuantity = data.minOrderQuantity;
    if (data.isActive !== undefined) rule.isActive = data.isActive;
    if (data.startDate !== undefined) rule.startDate = data.startDate ? new Date(data.startDate) : undefined;
    if (data.endDate !== undefined) rule.endDate = data.endDate ? new Date(data.endDate) : undefined;

    return rule.save();
  }

  async deletePricingRule(id: string) {
    await this.getPricingRuleById(id);
    await ProductPricingRule.findByIdAndDelete(id);
    return { success: true, message: 'Pricing rule deleted successfully' };
  }

  // ==========================================
  // CENTRAL PRICING RESOLUTION ENGINE
  // ==========================================

  /**
   * Resolves the authoritative unit price and tier according to strict precedence:
   * 1. Valid customer-specific product price override (retailerId + productId)
   * 2. Customer's assigned pricing group (pricingGroupId + productId)
   * 3. Customer-type default pricing rule (customerType + productId OR product.wholesaleTiers)
   * 4. Existing configured default product price (dealerPricePaise / variant dealerPricePaise with tierPricing)
   */
  async resolveProductPrice(params: ResolvePriceParams): Promise<ResolvedPriceResult> {
    const { productId, variantId, quantity, retailerId, customerType, pricingGroupId } = params;

    const product = params.productDoc || (await Product.findById(productId));
    if (!product) {
      throw ApiError.notFound(`Product with ID ${productId} not found`);
    }

    const now = new Date();
    const dateQuery = {
      $and: [
        { $or: [{ startDate: null }, { startDate: { $lte: now } }] },
        { $or: [{ endDate: null }, { endDate: { $gte: now } }] },
      ],
    };

    // Baseline fallback price
    let baselineDealerPrice = product.dealerPricePaise;
    let selectedVariant: any = null;

    if (variantId && Array.isArray(product.variants)) {
      selectedVariant = product.variants.find(
        (v: any) => v._id?.toString() === variantId || v.id === variantId || v.sku === variantId
      );
      if (selectedVariant && typeof selectedVariant.dealerPricePaise === 'number') {
        baselineDealerPrice = selectedVariant.dealerPricePaise;
      }
    }

    let resolvedUnitPrice = baselineDealerPrice;
    let appliedRuleSource: ResolvedPriceResult['appliedRuleSource'] = 'product_default';
    let appliedTier: ResolvedPriceResult['appliedTier'] = undefined;
    let effectiveMoq = product.minOrderQuantity || 1;
    let eligibleTiers: ResolvedPriceResult['eligibleTiers'] = [];

    // Precedence 1: Customer-Specific Override
    if (retailerId && mongoose.Types.ObjectId.isValid(retailerId)) {
      const customerOverride = await ProductPricingRule.findOne({
        productId: product._id,
        retailerId: new mongoose.Types.ObjectId(retailerId),
        isActive: true,
        ...dateQuery,
      });

      if (customerOverride) {
        appliedRuleSource = 'customer_override';
        if (typeof customerOverride.customPricePaise === 'number' && customerOverride.customPricePaise > 0) {
          resolvedUnitPrice = customerOverride.customPricePaise;
        } else if (typeof customerOverride.discountPercent === 'number' && customerOverride.discountPercent > 0) {
          resolvedUnitPrice = Math.round(baselineDealerPrice * (1 - customerOverride.discountPercent / 100));
        }

        if (customerOverride.minOrderQuantity && customerOverride.minOrderQuantity > 0) {
          effectiveMoq = customerOverride.minOrderQuantity;
        }

        if (Array.isArray(customerOverride.tierPricing) && customerOverride.tierPricing.length > 0) {
          eligibleTiers = customerOverride.tierPricing;
          const tierRes = resolveTierPrice(customerOverride.tierPricing, quantity, resolvedUnitPrice);
          resolvedUnitPrice = tierRes.unitPricePaise;
          appliedTier = tierRes.appliedTier;
        }

        return {
          unitPricePaise: resolvedUnitPrice,
          baseUnitPricePaise: customerOverride.customPricePaise || baselineDealerPrice,
          appliedRuleSource,
          appliedTier,
          effectiveMoq,
          eligibleTiers,
        };
      }
    }

    // Precedence 2: Customer Assigned Pricing Group
    if (pricingGroupId && mongoose.Types.ObjectId.isValid(pricingGroupId)) {
      const groupRule = await ProductPricingRule.findOne({
        productId: product._id,
        pricingGroupId: new mongoose.Types.ObjectId(pricingGroupId),
        isActive: true,
        ...dateQuery,
      });

      if (groupRule) {
        appliedRuleSource = 'pricing_group';
        if (typeof groupRule.customPricePaise === 'number' && groupRule.customPricePaise > 0) {
          resolvedUnitPrice = groupRule.customPricePaise;
        } else if (typeof groupRule.discountPercent === 'number' && groupRule.discountPercent > 0) {
          resolvedUnitPrice = Math.round(baselineDealerPrice * (1 - groupRule.discountPercent / 100));
        }

        if (groupRule.minOrderQuantity && groupRule.minOrderQuantity > 0) {
          effectiveMoq = groupRule.minOrderQuantity;
        }

        if (Array.isArray(groupRule.tierPricing) && groupRule.tierPricing.length > 0) {
          eligibleTiers = groupRule.tierPricing;
          const tierRes = resolveTierPrice(groupRule.tierPricing, quantity, resolvedUnitPrice);
          resolvedUnitPrice = tierRes.unitPricePaise;
          appliedTier = tierRes.appliedTier;
        }

        return {
          unitPricePaise: resolvedUnitPrice,
          baseUnitPricePaise: groupRule.customPricePaise || baselineDealerPrice,
          appliedRuleSource,
          appliedTier,
          effectiveMoq,
          eligibleTiers,
        };
      }
    }

    // Precedence 3: Customer-Type Default Rule
    const cleanCustomerType = customerType ? customerType.toLowerCase() : null;
    if (cleanCustomerType) {
      // 3a. Check ProductPricingRule for customerType
      const typeRule = await ProductPricingRule.findOne({
        productId: product._id,
        customerType: cleanCustomerType,
        isActive: true,
        ...dateQuery,
      });

      if (typeRule) {
        appliedRuleSource = 'customer_type';
        if (typeof typeRule.customPricePaise === 'number' && typeRule.customPricePaise > 0) {
          resolvedUnitPrice = typeRule.customPricePaise;
        } else if (typeof typeRule.discountPercent === 'number' && typeRule.discountPercent > 0) {
          resolvedUnitPrice = Math.round(baselineDealerPrice * (1 - typeRule.discountPercent / 100));
        }

        if (typeRule.minOrderQuantity && typeRule.minOrderQuantity > 0) {
          effectiveMoq = typeRule.minOrderQuantity;
        }

        if (Array.isArray(typeRule.tierPricing) && typeRule.tierPricing.length > 0) {
          eligibleTiers = typeRule.tierPricing;
          const tierRes = resolveTierPrice(typeRule.tierPricing, quantity, resolvedUnitPrice);
          resolvedUnitPrice = tierRes.unitPricePaise;
          appliedTier = tierRes.appliedTier;
        }

        return {
          unitPricePaise: resolvedUnitPrice,
          baseUnitPricePaise: typeRule.customPricePaise || baselineDealerPrice,
          appliedRuleSource,
          appliedTier,
          effectiveMoq,
          eligibleTiers,
        };
      }

      // 3b. Check product.wholesaleTiers embedded on Product
      if (Array.isArray(product.wholesaleTiers) && product.wholesaleTiers.length > 0) {
        const matchedWholesaleTier = product.wholesaleTiers.find(
          (t: any) =>
            t.customerType?.toLowerCase() === cleanCustomerType ||
            (cleanCustomerType === 'retailer' && t.customerType?.toLowerCase() === 'new') ||
            (cleanCustomerType === 'wholesaler' && t.customerType?.toLowerCase() === 'old')
        );

        if (matchedWholesaleTier) {
          appliedRuleSource = 'customer_type';
          if (typeof matchedWholesaleTier.pricePaise === 'number' && matchedWholesaleTier.pricePaise > 0) {
            resolvedUnitPrice = matchedWholesaleTier.pricePaise;
          } else if (typeof matchedWholesaleTier.discountPercent === 'number' && matchedWholesaleTier.discountPercent > 0) {
            resolvedUnitPrice = Math.round(baselineDealerPrice * (1 - matchedWholesaleTier.discountPercent / 100));
          }
          if (matchedWholesaleTier.minQuantity && matchedWholesaleTier.minQuantity > 0) {
            effectiveMoq = matchedWholesaleTier.minQuantity;
          }

          return {
            unitPricePaise: resolvedUnitPrice,
            baseUnitPricePaise: matchedWholesaleTier.pricePaise || baselineDealerPrice,
            appliedRuleSource,
            appliedTier: undefined,
            effectiveMoq,
            eligibleTiers: [],
          };
        }
      }
    }

    // Precedence 4: Configured Baseline Product Default with Tier Pricing
    appliedRuleSource = 'product_default';
    if (
      selectedVariant &&
      selectedVariant.isTierPricingEnabled &&
      Array.isArray(selectedVariant.tierPricing) &&
      selectedVariant.tierPricing.length > 0
    ) {
      eligibleTiers = selectedVariant.tierPricing;
      const tierRes = resolveTierPrice(selectedVariant.tierPricing, quantity, resolvedUnitPrice);
      resolvedUnitPrice = tierRes.unitPricePaise;
      appliedTier = tierRes.appliedTier;
    } else if (
      product.isTierPricingEnabled &&
      Array.isArray(product.tierPricing) &&
      product.tierPricing.length > 0
    ) {
      eligibleTiers = product.tierPricing;
      const tierRes = resolveTierPrice(product.tierPricing, quantity, resolvedUnitPrice);
      resolvedUnitPrice = tierRes.unitPricePaise;
      appliedTier = tierRes.appliedTier;
    }

    return {
      unitPricePaise: resolvedUnitPrice,
      baseUnitPricePaise: baselineDealerPrice,
      appliedRuleSource,
      appliedTier,
      effectiveMoq,
      eligibleTiers,
    };
  }
}

export const pricingService = new PricingService();
