import mongoose from 'mongoose';
import { Product } from '../products/product.model';
import { Retailer } from '../retailers/retailer.model';
import { ApiError } from '../../utils/api-error';
import { IOrderItemDocument } from './order.model';
import { resolveTierPrice } from '@necessity/shared';
import { discountService } from '../discounts/discount.service';
import { pricingService } from '../pricing/pricing.service';

export const SELLER_STATE_CODE = '27'; // Maharashtra (Necessity India Pvt. Ltd. HQ)

export interface CartCalculationInput {
  items: Array<{ productId: string; variantId?: string; quantity: number }>;
  deliveryStateCode: string;
  customerType?: string;
  pricingGroupId?: string;
  discountGroupId?: string;
  retailerId?: string;
  couponCode?: string;
}

export interface CalculatedCartResult {
  items: IOrderItemDocument[];
  subtotalPaise: number;
  totalProductDiscountPaise: number;
  couponCode?: string;
  couponDiscountPaise: number;
  totalDiscountPaise: number;
  taxableAmountPaise: number;
  totalCgstPaise: number;
  totalSgstPaise: number;
  totalIgstPaise: number;
  deliveryFeePaise: number;
  grandTotalPaise: number;
}

export class CartService {
  async calculateCart(input: CartCalculationInput): Promise<CalculatedCartResult> {
    const { items, deliveryStateCode, customerType, retailerId, couponCode } = input;

    if (!items || items.length === 0) {
      throw ApiError.badRequest('Cart is empty');
    }

    let effectiveCustomerType = customerType;
    let effectivePricingGroupId = input.pricingGroupId;
    let effectiveDiscountGroupId = input.discountGroupId;

    if (retailerId && mongoose.Types.ObjectId.isValid(retailerId)) {
      const retailer = await Retailer.findById(retailerId).select('customerType pricingGroupId discountGroupId');
      if (retailer) {
        effectiveCustomerType = retailer.customerType || effectiveCustomerType;
        if (retailer.pricingGroupId) effectivePricingGroupId = retailer.pricingGroupId.toString();
        if (retailer.discountGroupId) effectiveDiscountGroupId = retailer.discountGroupId.toString();
      }
    }

    const productIds = items.map((i) => {
      if (!mongoose.Types.ObjectId.isValid(i.productId)) {
        throw ApiError.badRequest(`Invalid product ID: ${i.productId}`);
      }
      return new mongoose.Types.ObjectId(i.productId);
    });

    const products = await Product.find({ _id: { $in: productIds } });
    const productMap = new Map(products.map((p) => [p._id.toString(), p]));

    const isIntraState = deliveryStateCode === SELLER_STATE_CODE;

    // Intermediate collection of processed items before coupon allocation
    interface ProcessedItemIntermediate {
      product: any;
      selectedVariant: any;
      appliedTier: any;
      formattedVariantName?: string;
      variantAttrs?: any;
      effectiveGstRate: number;
      appliedUnitPrice: number;
      quantity: number;
      itemSubtotalPaise: number;
      unitProductDiscountPaise: number;
      itemProductDiscountPaise: number;
      postProductTaxablePaise: number;
      productDiscountName?: string;
      productDiscountType?: string;
      productDiscountValue?: number;
    }

    const intermediateItems: ProcessedItemIntermediate[] = [];
    let subtotalPaise = 0;
    let totalProductDiscountPaise = 0;
    let orderTaxableBeforeCouponPaise = 0;

    for (const item of items) {
      const product = productMap.get(item.productId);
      if (!product) {
        throw ApiError.badRequest(`Product with ID ${item.productId} was not found`);
      }

      if (!product.isActive) {
        throw ApiError.badRequest(`Product '${product.name}' is no longer active for ordering`);
      }

      if (item.quantity < product.minOrderQuantity) {
        throw ApiError.badRequest(
          `Minimum order quantity for '${product.name}' is ${product.minOrderQuantity} ${product.uom}`
        );
      }

      if (item.quantity % product.orderQuantityMultiple !== 0) {
        throw ApiError.badRequest(
          `Order quantity for '${product.name}' must be in multiples of ${product.orderQuantityMultiple}`
        );
      }

      // 1. Resolve Variant
      let selectedVariant: any = null;
      const hasVariants = product.hasVariants || (Array.isArray(product.variants) && product.variants.length > 0);

      if (hasVariants) {
        if (!item.variantId) {
          throw ApiError.badRequest(
            `Please select a variant for product '${product.name}'`
          );
        }

        selectedVariant = product.variants?.find(
          (v: any) =>
            v._id?.toString() === item.variantId ||
            v.id === item.variantId ||
            v.sku === item.variantId
        );

        if (!selectedVariant) {
          throw ApiError.badRequest(
            `Selected variant not found for product '${product.name}'`
          );
        }

        if (!selectedVariant.isActive) {
          throw ApiError.badRequest(
            `Selected variant '${selectedVariant.name || selectedVariant.sku}' of '${product.name}' is no longer active`
          );
        }
      } else if (item.variantId && Array.isArray(product.variants)) {
        selectedVariant = product.variants.find(
          (v: any) =>
            v._id?.toString() === item.variantId ||
            v.id === item.variantId
        );
      }

      // 2. Stock Availability Check
      if (selectedVariant) {
        const variantAvailable = Math.max(
          0,
          (selectedVariant.stockOnHand || 0) - (selectedVariant.stockReserved || 0)
        );
        if (item.quantity > variantAvailable) {
          throw ApiError.badRequest(
            `Insufficient stock for variant '${selectedVariant.name || selectedVariant.sku}' of '${product.name}'. Requested ${item.quantity}, but only ${variantAvailable} ${product.uom} available`
          );
        }
      } else {
        const availableStock = Math.max(0, product.stockOnHand - product.stockReserved);
        if (item.quantity > availableStock) {
          throw ApiError.badRequest(
            `Insufficient stock for '${product.name}'. Requested ${item.quantity}, but only ${availableStock} ${product.uom} available`
          );
        }
      }

      // 3. Step 1: Resolve Unit Price using PricingEngine (Precedence: Customer Override -> Pricing Group -> Customer Type -> Product Default)
      const resolvedPricing = await pricingService.resolveProductPrice({
        productId: product._id.toString(),
        variantId: selectedVariant?._id?.toString() || selectedVariant?.id,
        quantity: item.quantity,
        retailerId,
        customerType: effectiveCustomerType,
        pricingGroupId: effectivePricingGroupId,
        productDoc: product,
      });

      const appliedUnitPrice = resolvedPricing.unitPricePaise;
      const appliedTier = resolvedPricing.appliedTier;

      // Validate effective MOQ (rule MOQ or product MOQ)
      if (item.quantity < resolvedPricing.effectiveMoq) {
        throw ApiError.badRequest(
          `Minimum order quantity for '${product.name}' is ${resolvedPricing.effectiveMoq} ${product.uom}`
        );
      }

      // Step 2: Calculate eligible product-level discounts
      const productDiscountRes = await discountService.resolveProductDiscount(
        product,
        item.quantity,
        appliedUnitPrice,
        effectiveCustomerType,
        effectivePricingGroupId,
        effectiveDiscountGroupId
      );

      const unitProductDiscountPaise = productDiscountRes.unitDiscountPaise || 0;
      const itemProductDiscountPaise = unitProductDiscountPaise * item.quantity;
      const itemSubtotalPaise = appliedUnitPrice * item.quantity;
      const postProductTaxablePaise = Math.max(0, itemSubtotalPaise - itemProductDiscountPaise);

      const variantAttrs =
        selectedVariant?.attributes instanceof Map
          ? Object.fromEntries(selectedVariant.attributes)
          : selectedVariant?.attributes;

      const formattedVariantName = selectedVariant?.name ||
        (variantAttrs ? Object.entries(variantAttrs).map(([k, v]) => `${k}: ${v}`).join(' • ') : undefined);

      const effectiveGstRate = typeof product.gstRatePercent === 'number' ? product.gstRatePercent : 18;

      intermediateItems.push({
        product,
        selectedVariant,
        appliedTier,
        formattedVariantName,
        variantAttrs,
        effectiveGstRate,
        appliedUnitPrice,
        quantity: item.quantity,
        itemSubtotalPaise,
        unitProductDiscountPaise,
        itemProductDiscountPaise,
        postProductTaxablePaise,
        productDiscountName: productDiscountRes.discountName,
        productDiscountType: productDiscountRes.discountType,
        productDiscountValue: productDiscountRes.discountValue,
      });

      subtotalPaise += itemSubtotalPaise;
      totalProductDiscountPaise += itemProductDiscountPaise;
      orderTaxableBeforeCouponPaise += postProductTaxablePaise;
    }

    // Step 4: Validate coupon against eligible items and minimum order amount
    let appliedCouponCode: string | undefined = undefined;
    let totalCouponDiscountPaise = 0;

    if (couponCode && couponCode.trim()) {
      const couponValidation = await discountService.validateCoupon(
        couponCode.trim(),
        orderTaxableBeforeCouponPaise,
        retailerId,
        effectiveCustomerType,
        effectivePricingGroupId,
        effectiveDiscountGroupId
      );

      appliedCouponCode = couponValidation.coupon.code;
      // Step 5: Calculate coupon discount without allowing negative totals
      totalCouponDiscountPaise = Math.min(
        couponValidation.discountAmountPaise,
        orderTaxableBeforeCouponPaise
      );
    }

    // Allocate coupon discount proportionally across items so line item taxes round cleanly
    const calculatedItems: IOrderItemDocument[] = [];
    let allocatedCouponDiscount = 0;
    let taxableAmountPaise = 0;
    let totalCgstPaise = 0;
    let totalSgstPaise = 0;
    let totalIgstPaise = 0;

    for (let idx = 0; idx < intermediateItems.length; idx++) {
      const it = intermediateItems[idx];
      const isLast = idx === intermediateItems.length - 1;

      let itemCouponDiscountPaise = 0;
      if (totalCouponDiscountPaise > 0 && orderTaxableBeforeCouponPaise > 0) {
        if (isLast) {
          // Last item absorbs any integer rounding difference
          itemCouponDiscountPaise = Math.max(0, totalCouponDiscountPaise - allocatedCouponDiscount);
        } else {
          itemCouponDiscountPaise = Math.round(
            (it.postProductTaxablePaise / orderTaxableBeforeCouponPaise) * totalCouponDiscountPaise
          );
          allocatedCouponDiscount += itemCouponDiscountPaise;
        }
      }

      // Ensure item coupon discount does not exceed item post-product taxable amount
      itemCouponDiscountPaise = Math.min(itemCouponDiscountPaise, it.postProductTaxablePaise);

      // Final line-level taxable amount
      const finalItemTaxablePaise = Math.max(0, it.postProductTaxablePaise - itemCouponDiscountPaise);

      // Step 6: Calculate GST using the correct tax treatment
      let itemCgstPaise = 0;
      let itemSgstPaise = 0;
      let itemIgstPaise = 0;

      if (isIntraState) {
        const halfRate = it.effectiveGstRate / 2;
        itemCgstPaise = Math.round((finalItemTaxablePaise * halfRate) / 100);
        itemSgstPaise = Math.round((finalItemTaxablePaise * halfRate) / 100);
      } else {
        itemIgstPaise = Math.round((finalItemTaxablePaise * it.effectiveGstRate) / 100);
      }

      const lineTotalPaise =
        finalItemTaxablePaise + itemCgstPaise + itemSgstPaise + itemIgstPaise;

      calculatedItems.push({
        productId: it.product._id,
        variantId: it.selectedVariant?._id,
        skuSnapshot: it.selectedVariant?.sku || it.product.sku,
        variantSkuSnapshot: it.selectedVariant?.sku,
        productNameSnapshot: it.product.name,
        variantNameSnapshot: it.formattedVariantName,
        variantAttributesSnapshot: it.variantAttrs,
        tierAppliedSnapshot: it.appliedTier
          ? {
              minQuantity: it.appliedTier.minQuantity,
              maxQuantity: it.appliedTier.maxQuantity,
              unitPricePaise: it.appliedTier.unitPricePaise,
            }
          : undefined,
        tierMinQuantitySnapshot: it.appliedTier?.minQuantity,
        hsnCodeSnapshot: it.product.hsnCode,
        quantity: it.quantity,
        unitPricePaiseSnapshot: it.appliedUnitPrice,
        appliedDiscountPaise: it.itemProductDiscountPaise,
        productDiscountName: it.productDiscountName,
        productDiscountType: it.productDiscountType,
        productDiscountValue: it.productDiscountValue,
        couponDiscountPaise: itemCouponDiscountPaise,
        taxableAmountPaise: finalItemTaxablePaise,
        gstRatePercentSnapshot: it.effectiveGstRate,
        cgstPaise: itemCgstPaise,
        sgstPaise: itemSgstPaise,
        igstPaise: itemIgstPaise,
        lineTotalPaise,
      });

      taxableAmountPaise += finalItemTaxablePaise;
      totalCgstPaise += itemCgstPaise;
      totalSgstPaise += itemSgstPaise;
      totalIgstPaise += itemIgstPaise;
    }

    const totalDiscountPaise = totalProductDiscountPaise + totalCouponDiscountPaise;
    const deliveryFeePaise = 0;
    const grandTotalPaise =
      taxableAmountPaise +
      totalCgstPaise +
      totalSgstPaise +
      totalIgstPaise +
      deliveryFeePaise;

    return {
      items: calculatedItems,
      subtotalPaise,
      totalProductDiscountPaise,
      couponCode: appliedCouponCode,
      couponDiscountPaise: totalCouponDiscountPaise,
      totalDiscountPaise,
      taxableAmountPaise,
      totalCgstPaise,
      totalSgstPaise,
      totalIgstPaise,
      deliveryFeePaise,
      grandTotalPaise,
    };
  }
}

export const cartService = new CartService();
