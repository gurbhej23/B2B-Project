import mongoose, { Document, Schema } from 'mongoose';

export type StockTransactionType =
  | 'STOCK_IN'
  | 'STOCK_OUT'
  | 'MANUAL_ADJUSTMENT'
  | 'ORDER_RESERVED'
  | 'ORDER_CANCELLED'
  | 'ORDER_FULFILLED'
  | 'INITIAL_OPENING';

export interface IStockTransactionDocument extends Document {
  productId: mongoose.Types.ObjectId;
  sku: string;
  productName: string;
  transactionType: StockTransactionType;
  quantityDelta: number;
  previousStock: number;
  newStock: number;
  reason: string;
  warehouseLocation: string;
  actorId?: string;
  actorName?: string;
  orderId?: string;
  createdAt: Date;
  updatedAt: Date;
}

const StockTransactionSchema = new Schema<IStockTransactionDocument>(
  {
    productId: {
      type: Schema.Types.ObjectId,
      ref: 'Product',
      required: true,
      index: true,
    },
    sku: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      index: true,
    },
    productName: {
      type: String,
      required: true,
      trim: true,
    },
    transactionType: {
      type: String,
      required: true,
      enum: [
        'STOCK_IN',
        'STOCK_OUT',
        'MANUAL_ADJUSTMENT',
        'ORDER_RESERVED',
        'ORDER_CANCELLED',
        'ORDER_FULFILLED',
        'INITIAL_OPENING',
      ],
      default: 'MANUAL_ADJUSTMENT',
      index: true,
    },
    quantityDelta: {
      type: Number,
      required: true,
    },
    previousStock: {
      type: Number,
      required: true,
      min: 0,
    },
    newStock: {
      type: Number,
      required: true,
      min: 0,
    },
    reason: {
      type: String,
      required: true,
      trim: true,
    },
    warehouseLocation: {
      type: String,
      default: 'Main Central Warehouse',
      trim: true,
    },
    actorId: {
      type: String,
      trim: true,
    },
    actorName: {
      type: String,
      trim: true,
    },
    orderId: {
      type: String,
      trim: true,
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

StockTransactionSchema.index({ createdAt: -1 });

export const StockTransaction = mongoose.model<IStockTransactionDocument>(
  'StockTransaction',
  StockTransactionSchema
);
