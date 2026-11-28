import { z } from 'zod';
import { UserRole, AccountStatus, CustomerType, PaymentMethod, CreditStatus, DiscountType, DiscountScope } from '../enums';

// GSTIN Regex: 15 alphanumeric characters
export const GSTIN_REGEX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
// PAN Regex: 5 letters, 4 numbers, 1 letter
export const PAN_REGEX = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;
// Indian Phone Regex (10 digits or with +91)
export const PHONE_REGEX = /^(\+91)?[6-9]\d{9}$/;
// Pincode Regex (6 digits)
export const PINCODE_REGEX = /^[1-9][0-9]{5}$/;

export const addressSchema = z.object({
  street: z.string().min(3, 'Street address must be at least 3 characters'),
  city: z.string().min(2, 'City is required'),
  state: z.string().min(2, 'State is required'),
  pincode: z.string().regex(PINCODE_REGEX, 'Enter a valid 6-digit Indian PIN code'),
  stateCode: z.string().optional().default('27'),
  isDefault: z.boolean().optional(),
});

export const loginSchema = z.object({
  identifier: z.string().min(3, 'Email or Phone is required'),
  password: z.string().min(6, 'Password is required'),
  rememberMe: z.boolean().optional().default(false),
});

export const registerRetailerSchema = z.object({
  businessName: z.string().min(3, 'Business name must be at least 3 characters'),
  businessType: z.string().optional().default('Retailer'),
  requestedCustomerType: z.string().optional(),
  tradeName: z.string().optional(),
  contactPerson: z.string().min(2, 'Contact person name is required'),
  phone: z.string().regex(PHONE_REGEX, 'Enter a valid 10-digit Indian phone number'),
  email: z.string().email('Invalid email address').optional().or(z.literal('')),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number')
    .regex(/[^A-Za-z0-9]/, 'Password must contain at least one special character'),
  gstin: z
    .string()
    .toUpperCase()
    .regex(GSTIN_REGEX, 'Enter a valid 15-character GSTIN')
    .optional()
    .or(z.literal('')),
  pan: z
    .string()
    .toUpperCase()
    .regex(PAN_REGEX, 'Enter a valid 10-character PAN')
    .optional()
    .or(z.literal('')),
  billingAddress: addressSchema,
  deliveryAddress: addressSchema.optional(),
  businessDocuments: z
    .array(
      z.object({
        documentType: z.string().trim().optional().or(z.literal('')),
        documentNumber: z.string().trim().optional().or(z.literal('')),
        fileUrl: z.string().optional(),
        fileName: z.string().optional(),
      })
    )
    .optional()
    .default([]),
  termsAccepted: z.literal(true, {
    errorMap: () => ({ message: 'You must accept the terms and conditions' }),
  }),
});

export const createStaffSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Valid email address is required'),
  phone: z.string().regex(PHONE_REGEX, 'Enter a valid 10-digit Indian phone number'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number')
    .regex(/[^A-Za-z0-9]/, 'Password must contain at least one special character'),
  role: z.enum([
    UserRole.ADMIN,
    UserRole.ACCOUNTS_MANAGER,
    UserRole.SALES_MANAGER,
    UserRole.SALESMAN,
    UserRole.WAREHOUSE_MANAGER,
  ]),
});

export const refreshTokenSchema = z.object({
  refreshToken: z.string().min(10, 'Valid refresh token is required'),
});

export const forgotPasswordSchema = z.object({
  identifier: z.string().min(3, 'Email or phone number is required'),
});

export const resetPasswordSchema = z.object({
  token: z.string().min(10, 'Reset token is required'),
  newPassword: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number')
    .regex(/[^A-Za-z0-9]/, 'Password must contain at least one special character'),
});

export const retailerApprovalSchema = z.object({
  status: z.enum([AccountStatus.ACTIVE, AccountStatus.REJECTED, AccountStatus.SUSPENDED]),
  customerType: z.nativeEnum(CustomerType).optional().default(CustomerType.RETAILER),
  pricingGroupId: z.string().optional().nullable(),
  discountGroupId: z.string().optional().nullable(),
  creditLimitPaise: z.number().int().nonnegative().optional().default(0),
  paymentTermsDays: z.number().int().positive().optional().default(15),
  creditStatus: z.nativeEnum(CreditStatus).optional().default(CreditStatus.NORMAL),
  creditHoldReason: z.string().optional(),
  assignedSalesmanId: z.string().optional(),
  rejectionReason: z.string().optional(),
});

export const updateCustomerTypeSchema = z.object({
  customerType: z.nativeEnum(CustomerType),
  pricingGroupId: z.string().optional().nullable(),
  discountGroupId: z.string().optional().nullable(),
  creditLimitPaise: z.number().int().nonnegative().optional(),
  paymentTermsDays: z.number().int().positive().optional(),
  creditStatus: z.nativeEnum(CreditStatus).optional(),
});

export const createPricingGroupSchema = z.object({
  name: z.string().min(2, 'Pricing group name is required'),
  code: z
    .string()
    .min(2, 'Code is required')
    .toLowerCase()
    .regex(/^[a-z0-9_-]+$/, 'Code must be alphanumeric with dashes/underscores'),
  description: z.string().optional(),
  applicableCustomerTypes: z.array(z.nativeEnum(CustomerType)).optional().default([CustomerType.RETAILER]),
  isDefault: z.boolean().optional().default(false),
  isActive: z.boolean().optional().default(true),
});

export const updatePricingGroupSchema = createPricingGroupSchema.partial();


export const tierPriceSchema = z.object({
  minQuantity: z.number().int().positive('Minimum quantity must be at least 1'),
  maxQuantity: z.number().int().positive().optional(),
  unitPricePaise: z.number().int().nonnegative('Unit price must be non-negative'),
});

export const createProductPricingRuleSchema = z.object({
  productId: z.string().min(1, 'Product ID is required'),
  variantId: z.string().optional().nullable(),
  pricingGroupId: z.string().optional().nullable(),
  retailerId: z.string().optional().nullable(),
  customerType: z.nativeEnum(CustomerType).optional().nullable(),
  customPricePaise: z.number().int().nonnegative().optional().nullable(),
  discountPercent: z.number().min(0).max(100).optional().nullable(),
  minOrderQuantity: z.number().int().positive().optional().nullable(),
  tierPricing: z.array(tierPriceSchema).optional(),
  isActive: z.boolean().optional().default(true),
  startDate: z.string().or(z.date()).optional().nullable(),
  endDate: z.string().or(z.date()).optional().nullable(),
});

export const updateProductPricingRuleSchema = createProductPricingRuleSchema.partial();

export const createDiscountGroupSchema = z.object({
  name: z.string().min(2, 'Discount group name is required'),
  code: z
    .string()
    .min(2, 'Code is required')
    .toLowerCase()
    .regex(/^[a-z0-9_-]+$/, 'Code must be alphanumeric with dashes/underscores'),
  description: z.string().optional(),
  discountPercent: z.number().min(0).max(100).optional().default(0),
  applicableCustomerTypes: z.array(z.nativeEnum(CustomerType)).optional().default([CustomerType.RETAILER]),
  isActive: z.boolean().optional().default(true),
});

export const updateDiscountGroupSchema = createDiscountGroupSchema.partial();

export const updateCustomerStatusSchema = z.object({
  isActive: z.boolean(),
  reason: z.string().optional(),
});

export const registerCustomerMobileSchema = z
  .object({
    name: z.string().trim().min(2, 'Full name must be at least 2 characters'),
    businessName: z.string().trim().min(3, 'Business or shop name must be at least 3 characters'),
    businessType: z.string().trim().optional().default('Retailer'),
    requestedCustomerType: z.string().trim().optional(),
    email: z.string().trim().toLowerCase().email('Please enter a valid email address'),
    phone: z.string().trim().regex(PHONE_REGEX, 'Enter a valid 10-digit mobile number'),
    address: z.string().trim().min(3, 'Business address must be at least 3 characters'),
    city: z.string().trim().min(2, 'City is required'),
    state: z.string().trim().min(2, 'State is required'),
    pincode: z
      .string()
      .trim()
      .optional()
      .or(z.literal(''))
      .default('400001'),
    gstin: z
      .string()
      .toUpperCase()
      .regex(GSTIN_REGEX, 'Enter a valid 15-character GSTIN')
      .optional()
      .or(z.literal('')),
    pan: z
      .string()
      .toUpperCase()
      .regex(PAN_REGEX, 'Enter a valid 10-character PAN')
      .optional()
      .or(z.literal('')),
    businessDocuments: z
      .array(
        z.object({
          documentType: z.string().trim().optional().or(z.literal('')),
          documentNumber: z.string().trim().optional().or(z.literal('')),
          fileUrl: z.string().optional(),
          fileName: z.string().optional(),
        })
      )
      .optional()
      .default([]),
    password: z
      .string()
      .min(8, 'Password must be at least 8 characters')
      .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
      .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
      .regex(/[0-9]/, 'Password must contain at least one number')
      .regex(/[^A-Za-z0-9]/, 'Password must contain at least one special character'),
    confirmPassword: z.string().min(1, 'Confirm password is required'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });


export const productVariantSchema = z.object({
  id: z.string().optional(),
  _id: z.string().optional(),
  sku: z.string().min(1, 'Variant SKU is required'),
  name: z.string().optional(),
  attributes: z.record(z.string()).refine((attrs) => Object.keys(attrs).length > 0, {
    message: 'At least one variant attribute is required',
  }),
  mrpPaise: z.number().int().nonnegative().optional(),
  dealerPricePaise: z.number().int().nonnegative().optional(),
  stockOnHand: z.number().int().nonnegative().default(0),
  stockReserved: z.number().int().nonnegative().default(0),
  barcode: z.string().optional(),
  images: z
    .array(
      z.object({
        url: z.string().min(1),
        isPrimary: z.boolean().default(false),
        altText: z.string().optional(),
      })
    )
    .optional(),
  isTierPricingEnabled: z.boolean().optional(),
  tierPricing: z.array(tierPriceSchema).optional(),
  isActive: z.boolean().default(true),
});

export const orderItemInputSchema = z.object({
  productId: z.string().min(1, 'Product ID is required'),
  variantId: z.string().optional(),
  quantity: z.number().int().positive('Quantity must be at least 1'),
});

export const createOrderSchema = z.object({
  retailerId: z.string().optional(), // Inferred from session if retailer, or required if admin/salesman
  items: z.array(orderItemInputSchema).min(1, 'Order must contain at least one item'),
  paymentMethod: z.nativeEnum(PaymentMethod),
  deliveryAddress: addressSchema,
  couponCode: z.string().trim().optional(),
  customerNotes: z.string().max(500).optional(),
  idempotencyKey: z.string().min(8, 'Idempotency key is required'),
});

export const submitUtrSchema = z.object({
  paymentId: z.string().optional(),
  orderId: z.string().optional(),
  amountPaise: z.number().int().positive('Amount in paise must be positive'),
  utrNumber: z.string().min(6, 'Valid UTR / Bank Reference number is required'),
  bankName: z.string().min(2, 'Bank name is required'),
  remittanceDate: z.string().min(6, 'Remittance date is required'),
  proofDocUrl: z.string().url().optional(),
});

export const createProductDiscountSchema = z.object({
  name: z.string().min(3, 'Discount name must be at least 3 characters'),
  discountType: z.nativeEnum(DiscountType),
  discountValue: z.number().positive('Discount value must be greater than zero'),
  scope: z.nativeEnum(DiscountScope),
  applicableProductIds: z.array(z.string()).optional(),
  applicableCategoryIds: z.array(z.string()).optional(),
  eligibleCustomerTypes: z.array(z.string()).optional(),
  eligiblePricingGroupIds: z.array(z.string()).optional(),
  eligibleDiscountGroupIds: z.array(z.string()).optional(),
  minQuantity: z.number().int().min(1).optional(),
  maxDiscountPaise: z.number().int().positive().optional(),
  startDate: z.string().or(z.date()),
  endDate: z.string().or(z.date()),
  isActive: z.boolean().optional().default(true),
  priority: z.number().int().optional().default(1),
});

export const createCouponSchema = z.object({
  code: z.string().min(3, 'Coupon code must be at least 3 characters').regex(/^[A-Za-z0-9_-]+$/, 'Coupon code must be alphanumeric'),
  description: z.string().max(250).optional(),
  discountType: z.nativeEnum(DiscountType),
  discountValue: z.number().positive('Discount value must be greater than zero'),
  minOrderValuePaise: z.number().int().nonnegative().optional().default(0),
  maxDiscountPaise: z.number().int().positive().optional(),
  eligibleCustomerTypes: z.array(z.string()).optional(),
  eligiblePricingGroupIds: z.array(z.string()).optional(),
  eligibleDiscountGroupIds: z.array(z.string()).optional(),
  eligibleRetailerIds: z.array(z.string()).optional(),
  startDate: z.string().or(z.date()),
  endDate: z.string().or(z.date()),
  totalUsageLimit: z.number().int().positive().optional().nullable(),
  perCustomerLimit: z.number().int().positive().optional().default(1),
  isActive: z.boolean().optional().default(true),
});

export const validateCouponSchema = z.object({
  code: z.string().min(1, 'Coupon code is required'),
  items: z.array(orderItemInputSchema).min(1, 'At least one item is required in cart'),
  deliveryStateCode: z.string().optional().default('27'),
});

export const updateCustomerDetailsSchema = z.object({
  businessName: z.string().min(2, 'Business name must be at least 2 characters').optional(),
  tradeName: z.string().optional(),
  contactPerson: z.string().min(2, 'Contact person name is required').optional(),
  phone: z.string().regex(PHONE_REGEX, 'Enter a valid 10-digit Indian phone number').optional(),
  email: z.string().email('Invalid email address').optional().or(z.literal('')),
  gstin: z
    .string()
    .toUpperCase()
    .regex(GSTIN_REGEX, 'Enter a valid 15-character GSTIN')
    .optional()
    .or(z.literal('')),
  pan: z
    .string()
    .toUpperCase()
    .regex(PAN_REGEX, 'Enter a valid 10-character PAN')
    .optional()
    .or(z.literal('')),
  billingAddress: addressSchema.optional(),
  isActive: z.boolean().optional(),
});


