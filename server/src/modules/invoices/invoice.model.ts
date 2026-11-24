import mongoose, { Schema, Document } from 'mongoose';
import { InvoiceStatus } from '@necessity/shared';

export interface IInvoiceItemSubdocument {
  productId?: mongoose.Types.ObjectId;
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

export interface IInvoiceDocument extends Document {
  invoiceNumber: string;
  orderId?: mongoose.Types.ObjectId;
  orderNumber?: string;
  retailerId: mongoose.Types.ObjectId;
  retailerBusinessName: string;
  retailerGstin?: string;
  issueDate: Date;
  dueDate: Date;
  subtotalPaise: number;
  taxPaise: number;
  totalPaise: number;
  paidAmountPaise: number;
  outstandingAmountPaise: number;
  status: InvoiceStatus;
  items: IInvoiceItemSubdocument[];
  zohoInvoiceId?: string;
  zohoSyncStatus: 'not_synced' | 'synced' | 'failed';
  zohoLastSyncError?: string;
  zohoLastSyncedAt?: Date;
  notes?: string;
  createdByUserId?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const InvoiceItemSchema = new Schema<IInvoiceItemSubdocument>(
  {
    productId: {
      type: Schema.Types.ObjectId,
      ref: 'Product',
    },
    sku: {
      type: String,
      required: true,
      trim: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    hsnCode: {
      type: String,
      required: false,
      default: '',
      trim: true,
    },
    quantity: {
      type: Number,
      required: true,
      min: 1,
    },
    unitPricePaise: {
      type: Number,
      required: true,
      min: 0,
    },
    taxableAmountPaise: {
      type: Number,
      required: true,
      min: 0,
    },
    gstRatePercent: {
      type: Number,
      required: true,
      default: 0,
    },
    cgstPaise: {
      type: Number,
      required: true,
      default: 0,
    },
    sgstPaise: {
      type: Number,
      required: true,
      default: 0,
    },
    igstPaise: {
      type: Number,
      required: true,
      default: 0,
    },
    totalPaise: {
      type: Number,
      required: true,
      min: 0,
    },
  },
  { _id: false }
);

const InvoiceSchema = new Schema<IInvoiceDocument>(
  {
    invoiceNumber: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true,
    },
    orderId: {
      type: Schema.Types.ObjectId,
      ref: 'Order',
      sparse: true,
      index: true,
    },
    orderNumber: {
      type: String,
      trim: true,
      sparse: true,
      index: true,
    },
    retailerId: {
      type: Schema.Types.ObjectId,
      ref: 'Retailer',
      required: true,
      index: true,
    },
    retailerBusinessName: {
      type: String,
      required: true,
      trim: true,
    },
    retailerGstin: {
      type: String,
      trim: true,
      uppercase: true,
    },
    issueDate: {
      type: Date,
      required: true,
      default: Date.now,
      index: true,
    },
    dueDate: {
      type: Date,
      required: true,
      index: true,
    },
    subtotalPaise: {
      type: Number,
      required: true,
      min: 0,
    },
    taxPaise: {
      type: Number,
      required: true,
      min: 0,
    },
    totalPaise: {
      type: Number,
      required: true,
      min: 0,
    },
    paidAmountPaise: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },
    outstandingAmountPaise: {
      type: Number,
      required: true,
      min: 0,
    },
    status: {
      type: String,
      enum: Object.values(InvoiceStatus),
      default: InvoiceStatus.ISSUED,
      index: true,
    },
    items: {
      type: [InvoiceItemSchema],
      required: true,
      default: [],
    },
    zohoInvoiceId: {
      type: String,
      sparse: true,
      index: true,
    },
    zohoSyncStatus: {
      type: String,
      enum: ['not_synced', 'synced', 'failed'],
      default: 'not_synced',
      index: true,
    },
    zohoLastSyncError: {
      type: String,
    },
    zohoLastSyncedAt: {
      type: Date,
    },
    notes: {
      type: String,
      trim: true,
    },
    createdByUserId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
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

InvoiceSchema.index({ retailerId: 1, issueDate: -1 });
InvoiceSchema.index({ status: 1, dueDate: 1 });

export const Invoice = mongoose.model<IInvoiceDocument>('Invoice', InvoiceSchema);
