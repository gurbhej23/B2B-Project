import mongoose, { Document, Schema } from 'mongoose';

export interface ITierPriceItem {
  minQuantity: number;
  maxQuantity?: number;
  unitPricePaise: number;
}

export interface IProductVariantDocument {
  _id?: mongoose.Types.ObjectId;
  id?: string;
  sku: string;
  name?: string;
  attributes: Record<string, string> | Map<string, string>;
  mrpPaise?: number;
  dealerPricePaise?: number;
  stockOnHand: number;
  stockReserved: number;
  availableStock?: number;
  barcode?: string;
  images?: Array<{
    url: string;
    isPrimary?: boolean;
    altText?: string;
  }>;
  videos?: Array<{
    url: string;
    title?: string;
    thumbnailUrl?: string;
    durationSeconds?: number;
  }>;
  isTierPricingEnabled?: boolean;
  tierPricing?: ITierPriceItem[];
  isActive: boolean;
}

export interface IProductDocument extends Document {
  sku: string;
  productCode?: string;
  barcode?: string;
  name: string;
  description: string;
  categoryId: mongoose.Types.ObjectId;
  categoryName?: string;
  brand: string;
  images: Array<{
    url: string;
    isPrimary: boolean;
    altText?: string;
  }>;
  videos?: Array<{
    url: string;
    title?: string;
    thumbnailUrl?: string;
    durationSeconds?: number;
  }>;
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
  warehouseLocation?: string;
  zohoItemId?: string;
  zohoSyncStatus?: 'synced' | 'pending' | 'failed' | 'not_synced';
  zohoLastSyncedAt?: Date;
  isDraft?: boolean;
  visibilityInMobile?: boolean;
  batchNumber?: string;
  expiryDate?: Date;
  hasVariants?: boolean;
  variants?: IProductVariantDocument[];
  isTierPricingEnabled?: boolean;
  tierPricing?: ITierPriceItem[];
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
  createdAt: Date;
  updatedAt: Date;
}

const ProductSchema = new Schema<IProductDocument>(
  {
    sku: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      uppercase: true,
      index: true,
    },
    productCode: {
      type: String,
      trim: true,
    },
    barcode: {
      type: String,
      trim: true,
      sparse: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
      index: 'text',
    },
    description: {
      type: String,
      required: true,
      trim: true,
    },
    categoryId: {
      type: Schema.Types.ObjectId,
      ref: 'Category',
      required: true,
      index: true,
    },
    categoryName: {
      type: String,
      trim: true,
    },
    brand: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    images: [
      {
        url: { type: String, required: true },
        isPrimary: { type: Boolean, default: false },
        altText: { type: String, trim: true },
      },
    ],
    videos: [
      {
        url: { type: String, required: true },
        title: { type: String, trim: true },
        thumbnailUrl: { type: String, trim: true },
        durationSeconds: { type: Number },
      },
    ],
    uom: {
      type: String,
      required: true,
      default: 'PCS',
    },
    packSize: {
      type: Number,
      required: true,
      default: 1,
    },
    caseQuantity: {
      type: Number,
      required: false,
      default: 1,
    },
    mrpPaise: {
      type: Number,
      required: false,
      default: 0,
      min: 0,
    },
    dealerPricePaise: {
      type: Number,
      required: true,
      min: 0,
    },
    hsnCode: {
      type: String,
      required: false,
      default: '',
      trim: true,
      index: true,
    },
    gstRatePercent: {
      type: Number,
      required: false,
      enum: [0, 5, 12, 18, 28],
      default: 18,
    },
    minOrderQuantity: {
      type: Number,
      required: true,
      default: 1,
    },
    orderQuantityMultiple: {
      type: Number,
      required: false,
      default: 1,
    },
    stockOnHand: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },
    stockReserved: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },
    lowStockThreshold: {
      type: Number,
      default: 10,
    },
    warehouseLocation: {
      type: String,
      default: 'Main Central Warehouse',
      trim: true,
    },
    zohoItemId: {
      type: String,
      trim: true,
      sparse: true,
      index: true,
    },
    zohoSyncStatus: {
      type: String,
      enum: ['synced', 'pending', 'failed', 'not_synced'],
      default: 'not_synced',
      index: true,
    },
    zohoLastSyncedAt: {
      type: Date,
    },
    isDraft: {
      type: Boolean,
      default: false,
    },
    visibilityInMobile: {
      type: Boolean,
      default: true,
      index: true,
    },
    batchNumber: {
      type: String,
      trim: true,
    },
    expiryDate: {
      type: Date,
    },
    hasVariants: {
      type: Boolean,
      default: false,
      index: true,
    },
    variants: [
      {
        sku: {
          type: String,
          required: true,
          trim: true,
          uppercase: true,
        },
        name: {
          type: String,
          trim: true,
        },
        attributes: {
          type: Schema.Types.Mixed,
          default: {},
        },
        mrpPaise: {
          type: Number,
          min: 0,
        },
        dealerPricePaise: {
          type: Number,
          min: 0,
        },
        stockOnHand: {
          type: Number,
          default: 0,
          min: 0,
        },
        stockReserved: {
          type: Number,
          default: 0,
          min: 0,
        },
        barcode: {
          type: String,
          trim: true,
        },
        images: [
          {
            url: { type: String, required: true },
            isPrimary: { type: Boolean, default: false },
            altText: { type: String, trim: true },
          },
        ],
        videos: [
          {
            url: { type: String, required: true },
            title: { type: String, trim: true },
            thumbnailUrl: { type: String, trim: true },
            durationSeconds: { type: Number },
          },
        ],
        isTierPricingEnabled: {
          type: Boolean,
          default: false,
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
        },
      },
    ],
    isTierPricingEnabled: {
      type: Boolean,
      default: false,
      index: true,
    },
    tierPricing: [
      {
        minQuantity: { type: Number, required: true, min: 1 },
        maxQuantity: { type: Number, min: 1 },
        unitPricePaise: { type: Number, required: true, min: 0 },
      },
    ],
    wholesaleTiers: [
      {
        customerType: { type: String, required: true },
        discountPercent: { type: Number, min: 0, max: 100 },
        pricePaise: { type: Number, min: 0 },
        minQuantity: { type: Number, min: 1, default: 1 },
      },
    ],
    offers: [
      {
        minQuantity: { type: Number, required: true, min: 1 },
        discountPercent: { type: Number, required: true, min: 0, max: 100 },
        label: { type: String, required: true, trim: true },
      },
    ],
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
        ret.availableStock = Math.max(0, (ret.stockOnHand || 0) - (ret.stockReserved || 0));
        if (Array.isArray(ret.variants)) {
          ret.variants = ret.variants.map((v: any) => {
            const vObj = { ...v };
            if (vObj._id) {
              vObj.id = vObj._id.toString();
            }
            vObj.availableStock = Math.max(0, (vObj.stockOnHand || 0) - (vObj.stockReserved || 0));
            return vObj;
          });
        }
        delete ret._id;
        delete ret.__v;
        return ret;
      },
    },
  }
);

// Virtual for available stock
ProductSchema.virtual('availableStock').get(function () {
  return Math.max(0, (this.stockOnHand || 0) - (this.stockReserved || 0));
});

export const Product = mongoose.model<IProductDocument>('Product', ProductSchema);

