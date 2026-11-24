import mongoose, { Document, Schema } from 'mongoose';
import { CustomerType } from '@necessity/shared';

export interface IPricingGroupDocument extends Document {
  name: string;
  code: string;
  description?: string;
  applicableCustomerTypes: string[];
  isDefault: boolean;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface IProductPricingRuleDocument extends Document {
  productId: mongoose.Types.ObjectId;
  variantId?: mongoose.Types.ObjectId;
  pricingGroupId?: mongoose.Types.ObjectId;
  retailerId?: mongoose.Types.ObjectId;
  customerType?: string;
  customPricePaise?: number;
  discountPercent?: number;
  minOrderQuantity?: number;
  tierPricing?: Array<{
    minQuantity: number;
    maxQuantity?: number;
    unitPricePaise: number;
  }>;
  isActive: boolean;
  startDate?: Date;
  endDate?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const PricingGroupSchema = new Schema<IPricingGroupDocument>(
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
    applicableCustomerTypes: {
      type: [String],
      default: [CustomerType.RETAILER],
    },
    isDefault: {
      type: Boolean,
      default: false,
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

const ProductPricingRuleSchema = new Schema<IProductPricingRuleDocument>(
  {
    productId: {
      type: Schema.Types.ObjectId,
      ref: 'Product',
      required: true,
      index: true,
    },
    variantId: {
      type: Schema.Types.ObjectId,
      default: null,
    },
    pricingGroupId: {
      type: Schema.Types.ObjectId,
      ref: 'PricingGroup',
      default: null,
      index: true,
    },
    retailerId: {
      type: Schema.Types.ObjectId,
      ref: 'Retailer',
      default: null,
      index: true,
    },
    customerType: {
      type: String,
      default: null,
      index: true,
    },
    customPricePaise: {
      type: Number,
      min: 0,
    },
    discountPercent: {
      type: Number,
      min: 0,
      max: 100,
    },
    minOrderQuantity: {
      type: Number,
      min: 1,
    },
    tierPricing: [
      {
        minQuantity: { type: Number, required: true, min: 1 },
        maxQuantity: { type: Number, min: 1 },
        unitPricePaise: { type: Number, required: true, min: 0 },
      },
    ],
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    startDate: {
      type: Date,
      default: null,
    },
    endDate: {
      type: Date,
      default: null,
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

ProductPricingRuleSchema.index({ productId: 1, retailerId: 1, isActive: 1 });
ProductPricingRuleSchema.index({ productId: 1, pricingGroupId: 1, isActive: 1 });
ProductPricingRuleSchema.index({ productId: 1, customerType: 1, isActive: 1 });

export const PricingGroup = mongoose.model<IPricingGroupDocument>('PricingGroup', PricingGroupSchema);
export const ProductPricingRule = mongoose.model<IProductPricingRuleDocument>(
  'ProductPricingRule',
  ProductPricingRuleSchema
);

