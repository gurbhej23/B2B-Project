import {
  UserRole,
  AccountStatus,
  CustomerType,
  OrderStatus,
  InvoiceStatus,
  PaymentMethod,
  PaymentStatus,
  CreditStatus,
  CreditReservationStatus,
  LedgerEntryType,
  SchemeType,
  DiscountType,
  DiscountScope,
} from '../enums';

export interface IAddress {
  street: string;
  city: string;
  state: string;
  pincode: string;
  stateCode: string; // GST 2-digit state code
  isDefault?: boolean;
}

export interface IUser {
  id: string;
  email?: string;
  phone: string;
  name: string;
  role: UserRole;
  accountStatus: AccountStatus;
  retailerProfileId?: string;
  assignedTerritoryIds?: string[];
  createdAt: string;
  updatedAt: string;
}

export interface IRetailer {
  id: string;
  userId: string;
  businessName: string;
  tradeName?: string;
  gstin?: string;
  pan?: string;
  contactPerson: string;
  phone: string;
  email?: string;
  billingAddress: IAddress;
  deliveryAddresses: IAddress[];
  creditLimitPaise: number;
  paymentTermsDays: number;
  creditStatus: CreditStatus;
  creditHoldReason?: string;
  customerType?: CustomerType;
  pricingGroupId?: string | null;
  discountGroupId?: string | null;
  isActive?: boolean;
  rejectionReason?: string;
  approvalEmailSentAt?: string;
  approvalNotificationStatus?: 'pending' | 'sent' | 'failed';
  assignedSalesmanId?: string;
  assignedTerritoryId?: string;
  outstandingReceivablesPaise?: number;
  activeReservationsPaise?: number;
  availableCreditPaise?: number;
  approvedAt?: string;
  approvedBy?: string;
  createdAt: string;
  updatedAt: string;
}

export interface IProductImage {
  url: string;
  isPrimary: boolean;
  altText?: string;
}

export interface IProductVideo {
  url: string;
  title?: string;
  thumbnailUrl?: string;
  durationSeconds?: number;
}

export interface ITierPrice {
  minQuantity: number;
  maxQuantity?: number;
  unitPricePaise: number;
}

export interface IProductVariant {
  id?: string;
  _id?: string;
  sku: string;
  name?: string;
  attributes: Record<string, string>;
  mrpPaise?: number;
  dealerPricePaise?: number;
  stockOnHand: number;
  stockReserved: number;
  availableStock?: number;
  barcode?: string;
  images?: IProductImage[];
  videos?: IProductVideo[];
  isTierPricingEnabled?: boolean;
  tierPricing?: ITierPrice[];
  isActive: boolean;
}

export interface IProduct {
  id: string;
  sku: string;
  productCode?: string;
  barcode?: string;
  name: string;
  description: string;
  categoryId: string;
  categoryName?: string;
  brand: string;
  images: IProductImage[];
  videos?: IProductVideo[];
  uom: string;
  packSize: number;
  caseQuantity?: number;
  mrpPaise?: number;
  dealerPricePaise: number;
  hsnCode?: string;
  gstRatePercent?: number;
  minOrderQuantity: number;
  orderQuantityMultiple?: number;
  stockOnHand: number;
  stockReserved: number;
  availableStock?: number;
  lowStockThreshold: number;
  warehouseLocation?: string;
  zohoItemId?: string;
  zohoSyncStatus?: 'synced' | 'pending' | 'failed' | 'not_synced';
  zohoLastSyncedAt?: string;
  isDraft?: boolean;
  visibilityInMobile?: boolean;
  batchNumber?: string;
  expiryDate?: string;
  hasVariants?: boolean;
  variants?: IProductVariant[];
  isTierPricingEnabled?: boolean;
  tierPricing?: ITierPrice[];
  wholesaleTiers?: Array<{
    customerType: string;
    discountPercent?: number;
    pricePaise?: number;
    minQuantity?: number;
  }>;
  offers?: Array<{
    minQuantity: number;
    discountPercent: number;
    label: string;
  }>;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface IOrderItem {
  productId: string;
  variantId?: string;
  skuSnapshot: string;
  variantSkuSnapshot?: string;
  productNameSnapshot: string;
  variantNameSnapshot?: string;
  variantAttributesSnapshot?: Record<string, string>;
  tierAppliedSnapshot?: ITierPrice;
  tierMinQuantitySnapshot?: number;
  hsnCodeSnapshot?: string;
  quantity: number;
  unitPricePaiseSnapshot: number;
  appliedDiscountPaise: number;
  productDiscountName?: string;
  productDiscountType?: DiscountType;
  productDiscountValue?: number;
  couponDiscountPaise?: number;
  taxableAmountPaise: number;
  gstRatePercentSnapshot: number;
  cgstPaise: number;
  sgstPaise: number;
  igstPaise: number;
  lineTotalPaise: number;
}

export interface IOrder {
  id: string;
  orderNumber: string;
  retailerId: string;
  retailerName?: string;
  placedByUserId: string;
  placedByName?: string;
  salesmanId?: string;
  status: OrderStatus;
  cancellationReason?: string;
  items: IOrderItem[];
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
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  creditReservationId?: string;
  deliveryAddress: IAddress;
  customerNotes?: string;
  internalNotes?: string;
  expectedDeliveryDate?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ICreditAccount {
  retailerId: string;
  approvedCreditLimitPaise: number;
  paymentTermsDays: number;
  currentReceivablesPaise: number;
  overdueReceivablesPaise: number;
  activeReservationsPaise: number;
  availableCreditPaise: number;
  creditStatus: CreditStatus;
  creditHoldReason?: string;
}

export interface IPaymentAllocation {
  invoiceId: string;
  invoiceNumber?: string;
  amountPaise: number;
}

export interface IPayment {
  id: string;
  paymentNumber: string;
  retailerId: string;
  orderId?: string;
  amountPaise: number;
  method: PaymentMethod;
  status: PaymentStatus;
  gatewayProvider?: string;
  gatewayOrderId?: string;
  gatewayPaymentId?: string;
  bankTransferDetails?: {
    utrNumber: string;
    bankName: string;
    remittanceDate: string;
    proofDocUrl?: string;
    verifiedByUserId?: string;
    verifiedAt?: string;
  };
  allocations: IPaymentAllocation[];
  createdAt: string;
  updatedAt: string;
}

export interface ILedgerEntry {
  id: string;
  retailerId: string;
  entryNumber: string;
  date: string;
  type: LedgerEntryType;
  referenceModel: string;
  referenceId: string;
  referenceNumber: string;
  description: string;
  debitPaise: number;
  creditPaise: number;
  runningBalancePaise: number;
  createdAt: string;
}

export interface IInvoiceItem {
  productId: string;
  sku: string;
  name: string;
  hsnCode?: string;
  quantity: number;
  unitPricePaise: number;
  taxableAmountPaise: number;
  gstRatePercent: number;
  cgstPaise: number;
  sgstPaise: number;
  igstPaise: number;
  totalPaise: number;
}

export interface IInvoice {
  id: string;
  invoiceNumber: string;
  orderId?: string;
  orderNumber?: string;
  retailerId: string;
  retailerBusinessName: string;
  retailerGstin?: string;
  issueDate: string;
  dueDate: string;
  subtotalPaise: number;
  taxPaise: number;
  totalPaise: number;
  paidAmountPaise: number;
  outstandingAmountPaise: number;
  status: InvoiceStatus;
  items: IInvoiceItem[];
  zohoInvoiceId?: string;
  zohoSyncStatus?: 'not_synced' | 'synced' | 'failed';
  zohoLastSyncError?: string;
  zohoLastSyncedAt?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ICreditOverviewItem {
  id: string;
  retailerId: string;
  businessName: string;
  tradeName?: string;
  contactPerson: string;
  phone: string;
  email?: string;
  gstin?: string;
  creditLimitPaise: number;
  paymentTermsDays: number;
  creditStatus: CreditStatus;
  creditHoldReason?: string;
  outstandingReceivablesPaise: number;
  activeReservationsPaise: number;
  availableCreditPaise: number;
  lastLedgerDate?: string;
}


// API Response envelopes
export interface ApiResponse<T = any> {
  success: boolean;
  message?: string;
  data: T;
  timestamp: string;
}

export interface PaginatedResponse<T = any> {
  success: boolean;
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
  };
  timestamp: string;
}

export interface ApiErrorResponse {
  success: false;
  code?: string;
  message?: string;
  error: {
    code: string;
    message: string;
    details?: any;
    stack?: string;
  };
  timestamp: string;
}

export interface IProductDiscount {
  id: string;
  name: string;
  discountType: DiscountType;
  discountValue: number;
  scope: DiscountScope;
  applicableProductIds?: string[];
  applicableCategoryIds?: string[];
  eligibleCustomerTypes?: string[];
  minQuantity?: number;
  maxDiscountPaise?: number;
  startDate: string;
  endDate: string;
  isActive: boolean;
  priority?: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface ICoupon {
  id: string;
  code: string;
  description?: string;
  discountType: DiscountType;
  discountValue: number;
  minOrderValuePaise?: number;
  maxDiscountPaise?: number;
  eligibleCustomerTypes?: string[];
  eligibleRetailerIds?: string[];
  startDate: string;
  endDate: string;
  totalUsageLimit?: number;
  perCustomerLimit?: number;
  usageCount: number;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface ICouponRedemption {
  id: string;
  couponId: string;
  couponCode: string;
  retailerId: string;
  retailerName?: string;
  orderId: string;
  orderNumber?: string;
  discountAmountPaise: number;
  redeemedAt: string;
}
