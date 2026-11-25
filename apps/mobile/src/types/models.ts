import { OrderStatus, PaymentMethod, PaymentStatus, UserRole } from '@necessity/shared';

export interface MobileUser {
  id: string;
  _id?: string;
  name: string;
  email: string;
  phone: string;
  role: UserRole;
  accountStatus: 'PENDING' | 'ACTIVE' | 'DISABLED' | 'SUSPENDED';
  isActive: boolean;
}

export interface RetailerProfile {
  id: string;
  _id?: string;
  userId: string;
  businessName: string;
  tradeName?: string;
  gstin?: string;
  pan?: string;
  accountStatus: 'PENDING' | 'ACTIVE' | 'DISABLED' | 'SUSPENDED';
  isActive: boolean;
  creditLimitPaise: number;
  outstandingReceivablesPaise: number;
  activeReservationsPaise: number;
  availableCreditPaise: number;
  paymentTermsDays: number;
  customerType?: 'retailer' | 'wholesaler' | 'distributor' | string;
  pricingGroupId?: string;
  discountGroupId?: string;
  pricingGroupName?: string;
  discountGroupName?: string;
  billingAddress?: {
    street: string;
    city: string;
    state: string;
    pincode: string;
    stateCode?: string;
  };
  shippingAddress?: {
    street: string;
    city: string;
    state: string;
    pincode: string;
    stateCode?: string;
  };
  deliveryAddresses?: Array<{
    street: string;
    city: string;
    state: string;
    pincode: string;
    stateCode?: string;
    isDefault?: boolean;
  }>;
}

export interface ProductImage {
  url: string;
  isPrimary: boolean;
  altText?: string;
}

export interface ProductVideo {
  url: string;
  title?: string;
  thumbnailUrl?: string;
  durationSeconds?: number;
}

export interface TierPrice {
  minQuantity: number;
  maxQuantity?: number;
  unitPricePaise: number;
}

export interface ProductVariant {
  id?: string;
  _id?: string;
  sku: string;
  name?: string;
  attributes?: Record<string, string>;
  stockOnHand?: number;
  stockReserved?: number;
  dealerPricePaise?: number;
  mrpPaise?: number;
  barcode?: string;
  images?: ProductImage[];
  videos?: ProductVideo[];
  isActive?: boolean;
  isTierPricingEnabled?: boolean;
  tierPricing?: TierPrice[];
}

export interface WholesaleTier {
  customerType: string;
  discountPercent?: number;
  pricePaise?: number;
  minQuantity?: number;
}

export interface ProductOffer {
  minQuantity: number;
  discountPercent: number;
  label: string;
}

export interface Product {
  id: string;
  _id?: string;
  sku: string;
  productCode?: string;
  name: string;
  description: string;
  categoryId?: string;
  categoryName?: string;
  brand: string;
  images: ProductImage[];
  videos?: ProductVideo[];
  uom: string;
  packSize: number;
  caseQuantity?: number;
  mrpPaise: number;
  dealerPricePaise: number;
  hsnCode?: string;
  gstRatePercent?: number;
  minOrderQuantity: number;
  orderQuantityMultiple: number;
  stockOnHand: number;
  stockReserved: number;
  lowStockThreshold: number;
  wholesaleTiers?: WholesaleTier[];
  offers?: ProductOffer[];
  hasVariants?: boolean;
  variants?: ProductVariant[];
  isTierPricingEnabled?: boolean;
  tierPricing?: TierPrice[];
  isActive: boolean;
  visibilityInMobile?: boolean;
  activeDiscount?: {
    name: string;
    discountType: 'percentage' | 'fixed_amount';
    discountValue: number;
    discountedPricePaise: number;
    savingsPaise: number;
  };
}

export interface Category {
  id: string;
  _id?: string;
  name: string;
  slug?: string;
  description?: string;
  imageUrl?: string;
  isActive?: boolean;
}

export interface Brand {
  id: string;
  _id?: string;
  name: string;
  description?: string;
  logoUrl?: string;
}

export interface CartItem {
  product: Product;
  quantity: number;
  variant?: ProductVariant;
}

export interface CalculatedOrderItem {
  productId: string;
  variantId?: string;
  skuSnapshot: string;
  productNameSnapshot: string;
  variantSkuSnapshot?: string;
  variantNameSnapshot?: string;
  variantAttributesSnapshot?: Record<string, string>;
  tierAppliedSnapshot?: boolean;
  tierMinQuantitySnapshot?: number;
  hsnCodeSnapshot?: string;
  quantity: number;
  unitPricePaiseSnapshot: number;
  appliedDiscountPaise: number;
  productDiscountName?: string;
  productDiscountType?: string;
  productDiscountValue?: number;
  couponDiscountPaise?: number;
  taxableAmountPaise: number;
  gstRatePercentSnapshot: number;
  cgstPaise: number;
  sgstPaise: number;
  igstPaise: number;
  lineTotalPaise: number;
}

export interface CalculatedCartSummary {
  items: CalculatedOrderItem[];
  subtotalPaise: number;
  totalProductDiscountPaise?: number;
  couponCode?: string;
  couponDiscountPaise?: number;
  totalDiscountPaise: number;
  taxableAmountPaise: number;
  totalCgstPaise: number;
  totalSgstPaise: number;
  totalIgstPaise: number;
  deliveryFeePaise: number;
  grandTotalPaise: number;
}

export interface OrderItemSnapshot {
  productId: string;
  variantId?: string;
  skuSnapshot: string;
  productNameSnapshot: string;
  variantSkuSnapshot?: string;
  variantNameSnapshot?: string;
  variantAttributesSnapshot?: Record<string, string>;
  tierAppliedSnapshot?: boolean;
  tierMinQuantitySnapshot?: number;
  hsnCodeSnapshot?: string;
  quantity: number;
  unitPricePaiseSnapshot: number;
  appliedDiscountPaise: number;
  taxableAmountPaise: number;
  gstRatePercentSnapshot: number;
  cgstPaise: number;
  sgstPaise: number;
  igstPaise: number;
  lineTotalPaise: number;
}

export interface Order {
  id: string;
  _id?: string;
  orderNumber: string;
  retailerId: string;
  retailerName: string;
  status: OrderStatus;
  cancellationReason?: string;
  items: OrderItemSnapshot[];
  subtotalPaise: number;
  totalDiscountPaise: number;
  taxableAmountPaise: number;
  totalCgstPaise: number;
  totalSgstPaise: number;
  totalIgstPaise: number;
  deliveryFeePaise: number;
  grandTotalPaise: number;
  totalPaidPaise?: number;
  remainingBalancePaise?: number;
  payments?: Array<{
    amountPaise: number;
    paymentMethod: string;
    referenceNumber: string;
    notes?: string;
    verifiedByName?: string;
    verifiedByRole?: string;
    verifiedAt?: string;
  }>;
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  deliveryAddress: {
    street: string;
    city: string;
    state: string;
    pincode: string;
    stateCode?: string;
  };
  dispatchDetails?: {
    dispatchedAt?: string;
    courierName?: string;
    trackingNumber?: string;
    trackingUrl?: string;
    transportDetails?: string;
  };
  pickupDetails?: {
    pickedUpAt?: string;
    pickupLocation?: string;
    collectedBy?: string;
    notes?: string;
  };
  customerNotes?: string;
  createdAt: string;
  updatedAt: string;
}
