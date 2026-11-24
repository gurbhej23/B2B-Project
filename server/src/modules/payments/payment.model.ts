import mongoose, { Document, Schema } from 'mongoose';
import { PaymentMethod, PaymentStatus } from '@necessity/shared';

export interface IPaymentTransactionDocument extends Document {
  orderId?: mongoose.Types.ObjectId;
  invoiceId?: mongoose.Types.ObjectId;
  invoiceNumber?: string;
  retailerId: mongoose.Types.ObjectId;
  paymentMethod: PaymentMethod;
  provider: string;
  amountPaise: number;
  currency: string;
  status: PaymentStatus;
  providerOrderId?: string;
  providerPaymentId?: string;
  signature?: string;
  bankReferenceUtr?: string;
  idempotencyKey?: string;
  verifiedByUserId?: mongoose.Types.ObjectId;
  verifiedAt?: Date;
  notes?: string;
  failureReason?: string;
  createdAt: Date;
  updatedAt: Date;
}

const PaymentTransactionSchema = new Schema<IPaymentTransactionDocument>(
  {
    orderId: {
      type: Schema.Types.ObjectId,
      ref: 'Order',
      sparse: true,
      index: true,
    },
    invoiceId: {
      type: Schema.Types.ObjectId,
      ref: 'Invoice',
      sparse: true,
      index: true,
    },
    invoiceNumber: {
      type: String,
      sparse: true,
      index: true,
    },
    retailerId: {
      type: Schema.Types.ObjectId,
      ref: 'Retailer',
      required: true,
      index: true,
    },
    paymentMethod: {
      type: String,
      enum: Object.values(PaymentMethod),
      required: true,
    },
    provider: {
      type: String,
      required: true,
      default: 'razorpay',
    },
    amountPaise: {
      type: Number,
      required: true,
      min: 1,
    },
    currency: {
      type: String,
      required: true,
      default: 'INR',
    },
    status: {
      type: String,
      enum: Object.values(PaymentStatus),
      default: PaymentStatus.INITIATED,
      index: true,
    },
    providerOrderId: {
      type: String,
      sparse: true,
      index: true,
    },
    providerPaymentId: {
      type: String,
      sparse: true,
      index: true,
    },
    signature: {
      type: String,
    },
    bankReferenceUtr: {
      type: String,
      sparse: true,
      trim: true,
      index: true,
    },
    idempotencyKey: {
      type: String,
      unique: true,
      sparse: true,
    },
    verifiedByUserId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    verifiedAt: {
      type: Date,
    },
    notes: {
      type: String,
    },
    failureReason: {
      type: String,
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

export const PaymentTransaction = mongoose.model<IPaymentTransactionDocument>(
  'PaymentTransaction',
  PaymentTransactionSchema
);
