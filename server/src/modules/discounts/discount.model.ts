import mongoose, { Document, Schema } from 'mongoose';
import { DiscountType, DiscountScope, CustomerType } from '@necessity/shared';

export interface IDiscountGroupDocument extends Document {
  name: string;
  code: string;
  description?: string;
  discountPercent?: number;
  applicableCustomerTypes: string[];
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface IProductDiscountDocument extends Document {
  name: string;
  discountType: DiscountType;
  discountValue: number; // Percentage (e.g. 10) or paise (e.g. 5000 for ₹50)
  scope: DiscountScope;
  applicableProductIds?: mongoose.Types.ObjectId[];
  applicableCategoryIds?: mongoose.Types.ObjectId[];
  eligibleCustomerTypes?: string[];
  eligiblePricingGroupIds?: mongoose.Types.ObjectId[];
  eligibleDiscountGroupIds?: mongoose.Types.ObjectId[];
  minQuantity?: number;
  maxDiscountPaise?: number;
  startDate: Date;
  endDate: Date;
  isActive: boolean;
  priority: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface ICouponDocument extends Document {
  code: string;
  description?: string;
  discountType: DiscountType;
  discountValue: number;
  minOrderValuePaise: number;
  maxDiscountPaise?: number;
  eligibleCustomerTypes?: string[];
  eligiblePricingGroupIds?: mongoose.Types.ObjectId[];
  eligibleDiscountGroupIds?: mongoose.Types.ObjectId[];
  eligibleRetailerIds?: mongoose.Types.ObjectId[];
  startDate: Date;
  endDate: Date;
  totalUsageLimit?: number | null;
  perCustomerLimit: number;
  usageCount: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface ICouponRedemptionDocument extends Document {
  couponId: mongoose.Types.ObjectId;
  couponCode: string;
  retailerId: mongoose.Types.ObjectId;
  retailerName?: string;
  orderId: mongoose.Types.ObjectId;
  orderNumber?: string;
  discountAmountPaise: number;
  redeemedAt: Date;
}

const ProductDiscountSchema = new Schema<IProductDiscountDocument>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    discountType: {
      type: String,
      enum: Object.values(DiscountType),
      required: true,
    },
    discountValue: {
      type: Number,
      required: true,
      min: 0,
    },
    scope: {
      type: String,
      enum: Object.values(DiscountScope),
      required: true,
      default: DiscountScope.ALL_PRODUCTS,
    },
    applicableProductIds: [
      {
        type: Schema.Types.ObjectId,
        ref: 'Product',
      },
    ],
    applicableCategoryIds: [
      {
        type: Schema.Types.ObjectId,
        ref: 'Category',
      },
    ],
    eligibleCustomerTypes: [
      {
        type: String,
        trim: true,
      },
    ],
    eligiblePricingGroupIds: [
      {
        type: Schema.Types.ObjectId,
        ref: 'PricingGroup',
      },
    ],
    eligibleDiscountGroupIds: [
      {
        type: Schema.Types.ObjectId,
        ref: 'DiscountGroup',
      },
    ],
    minQuantity: {
      type: Number,
      default: 1,
      min: 1,
    },
    maxDiscountPaise: {
      type: Number,
      min: 0,
    },
    startDate: {
      type: Date,
      required: true,
    },
    endDate: {
      type: Date,
      required: true,
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    priority: {
      type: Number,
      default: 1,
    },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform: (_doc, ret: any) => {
        ret.id = ret._id.toString();
        delete ret._id;
        delete ret.__v;
        return ret;
      },
    },
  }
);

ProductDiscountSchema.index({ isActive: 1, startDate: 1, endDate: 1 });

const CouponSchema = new Schema<ICouponDocument>(
  {
    code: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
      index: true,
    },
    description: {
      type: String,
      trim: true,
    },
    discountType: {
      type: String,
      enum: Object.values(DiscountType),
      required: true,
    },
    discountValue: {
      type: Number,
      required: true,
      min: 0,
    },
    minOrderValuePaise: {
      type: Number,
      default: 0,
      min: 0,
    },
    maxDiscountPaise: {
      type: Number,
      min: 0,
    },
    eligibleCustomerTypes: [
      {
        type: String,
        trim: true,
      },
    ],
    eligiblePricingGroupIds: [
      {
        type: Schema.Types.ObjectId,
        ref: 'PricingGroup',
      },
    ],
    eligibleDiscountGroupIds: [
      {
        type: Schema.Types.ObjectId,
        ref: 'DiscountGroup',
      },
    ],
    eligibleRetailerIds: [
      {
        type: Schema.Types.ObjectId,
        ref: 'Retailer',
      },
    ],
    startDate: {
      type: Date,
      required: true,
    },
    endDate: {
      type: Date,
      required: true,
    },
    totalUsageLimit: {
      type: Number,
      default: null,
      min: 1,
    },
    perCustomerLimit: {
      type: Number,
      default: 1,
      min: 1,
    },
    usageCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform: (_doc, ret: any) => {
        ret.id = ret._id.toString();
        delete ret._id;
        delete ret.__v;
        return ret;
      },
    },
  }
);

CouponSchema.index({ code: 1, isActive: 1 });

const CouponRedemptionSchema = new Schema<ICouponRedemptionDocument>(
  {
    couponId: {
      type: Schema.Types.ObjectId,
      ref: 'Coupon',
      required: true,
      index: true,
    },
    couponCode: {
      type: String,
      required: true,
      uppercase: true,
      index: true,
    },
    retailerId: {
      type: Schema.Types.ObjectId,
      ref: 'Retailer',
      required: true,
      index: true,
    },
    retailerName: {
      type: String,
      trim: true,
    },
    orderId: {
      type: Schema.Types.ObjectId,
      ref: 'Order',
      required: true,
      index: true,
    },
    orderNumber: {
      type: String,
      trim: true,
    },
    discountAmountPaise: {
      type: Number,
      required: true,
      min: 0,
    },
    redeemedAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform: (_doc, ret: any) => {
        ret.id = ret._id.toString();
        delete ret._id;
        delete ret.__v;
        return ret;
      },
    },
  }
);

const DiscountGroupSchema = new Schema<IDiscountGroupDocument>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    code: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
      index: true,
    },
    description: {
      type: String,
      trim: true,
    },
    discountPercent: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },
    applicableCustomerTypes: {
      type: [String],
      default: [CustomerType.RETAILER],
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform: (_doc, ret: any) => {
        ret.id = ret._id.toString();
        delete ret._id;
        delete ret.__v;
        return ret;
      },
    },
  }
);

export const DiscountGroup = mongoose.model<IDiscountGroupDocument>('DiscountGroup', DiscountGroupSchema);

export const ProductDiscount = mongoose.model<IProductDiscountDocument>(
  'ProductDiscount',
  ProductDiscountSchema
);

export const Coupon = mongoose.model<ICouponDocument>('Coupon', CouponSchema);

export const CouponRedemption = mongoose.model<ICouponRedemptionDocument>(
  'CouponRedemption',
  CouponRedemptionSchema
);
