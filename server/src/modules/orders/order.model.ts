import mongoose, { Document, Schema } from 'mongoose';
import { OrderStatus, PaymentMethod, PaymentStatus } from '@necessity/shared';

export interface IOrderItemDocument {
  productId: mongoose.Types.ObjectId;
  variantId?: mongoose.Types.ObjectId;
  skuSnapshot: string;
  variantSkuSnapshot?: string;
  productNameSnapshot: string;
  variantNameSnapshot?: string;
  variantAttributesSnapshot?: Record<string, string>;
  tierAppliedSnapshot?: {
    minQuantity: number;
    maxQuantity?: number;
    unitPricePaise: number;
  };
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

export interface IOrderStatusHistory {
  _id?: mongoose.Types.ObjectId;
  previousStatus: OrderStatus | string;
  newStatus: OrderStatus | string;
  changedByUserId?: mongoose.Types.ObjectId;
  changedByName?: string;
  changedByRole?: string;
  reason?: string;
  note?: string;
  timestamp: Date;
}

export interface IOrderPayment {
  _id?: mongoose.Types.ObjectId;
  amountPaise: number;
  paymentMethod: PaymentMethod | string;
  referenceNumber?: string;
  verifiedByUserId?: mongoose.Types.ObjectId;
  verifiedByName?: string;
  verifiedByRole?: string;
  verifiedAt: Date;
  notes?: string;
}

export interface IOrderNotification {
  _id?: mongoose.Types.ObjectId;
  status: OrderStatus;
  recipientEmail: string;
  recipientName: string;
  subject: string;
  success: boolean;
  sentAt?: Date;
  attemptedAt: Date;
  messageId?: string;
  error?: string;
  retryCount?: number;
  lastRetriedAt?: Date;
  lastRetriedBy?: string;
}

export interface IOrderDocument extends Document {
  orderNumber: string;
  retailerId: mongoose.Types.ObjectId;
  retailerName: string;
  placedByUserId: mongoose.Types.ObjectId;
  placedByName: string;
  salesmanId?: mongoose.Types.ObjectId;
  status: OrderStatus;
  cancellationReason?: string;
  items: IOrderItemDocument[];
  subtotalPaise: number;
  totalDiscountPaise: number;
  totalProductDiscountPaise?: number;
  couponCode?: string;
  couponDiscountPaise?: number;
  taxableAmountPaise: number;
  totalCgstPaise: number;
  totalSgstPaise: number;
  totalIgstPaise: number;
  deliveryFeePaise: number;
  grandTotalPaise: number;
  totalPaidPaise: number;
  remainingBalancePaise?: number;
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  payments: IOrderPayment[];
  statusHistory: IOrderStatusHistory[];
  creditReservationPaise?: number;
  deliveryAddress: {
    street: string;
    city: string;
    state: string;
    pincode: string;
    stateCode: string;
  };
  customerNotes?: string;
  internalNotes?: string;
  expectedDeliveryDate?: Date;
  idempotencyKey?: string;
  dispatchDetails?: {
    dispatchedAt?: Date;
    courierName?: string;
    trackingNumber?: string;
    trackingUrl?: string;
    transportDetails?: string;
  };
  pickupDetails?: {
    pickedUpAt?: Date;
    pickupLocation?: string;
    collectedBy?: string;
    notes?: string;
  };
  notifications: IOrderNotification[];
  createdAt: Date;
  updatedAt: Date;
}

const OrderItemSchema = new Schema<IOrderItemDocument>(
  {
    productId: {
      type: Schema.Types.ObjectId,
      ref: 'Product',
      required: true,
    },
    variantId: {
      type: Schema.Types.ObjectId,
    },
    skuSnapshot: {
      type: String,
      required: true,
    },
    variantSkuSnapshot: {
      type: String,
      trim: true,
    },
    productNameSnapshot: {
      type: String,
      required: true,
    },
    variantNameSnapshot: {
      type: String,
      trim: true,
    },
    variantAttributesSnapshot: {
      type: Schema.Types.Mixed,
    },
    tierAppliedSnapshot: {
      minQuantity: { type: Number },
      maxQuantity: { type: Number },
      unitPricePaise: { type: Number },
    },
    tierMinQuantitySnapshot: {
      type: Number,
    },
    hsnCodeSnapshot: {
      type: String,
      required: false,
      default: '',
    },
    quantity: {
      type: Number,
      required: true,
      min: 1,
    },
    unitPricePaiseSnapshot: {
      type: Number,
      required: true,
      min: 0,
    },
    appliedDiscountPaise: {
      type: Number,
      default: 0,
      min: 0,
    },
    productDiscountName: {
      type: String,
      trim: true,
    },
    productDiscountType: {
      type: String,
      trim: true,
    },
    productDiscountValue: {
      type: Number,
    },
    couponDiscountPaise: {
      type: Number,
      default: 0,
      min: 0,
    },
    taxableAmountPaise: {
      type: Number,
      required: true,
      min: 0,
    },
    gstRatePercentSnapshot: {
      type: Number,
      required: true,
    },
    cgstPaise: {
      type: Number,
      default: 0,
      min: 0,
    },
    sgstPaise: {
      type: Number,
      default: 0,
      min: 0,
    },
    igstPaise: {
      type: Number,
      default: 0,
      min: 0,
    },
    lineTotalPaise: {
      type: Number,
      required: true,
      min: 0,
    },
  },
  { _id: false }
);

const OrderNotificationSchema = new Schema<IOrderNotification>(
  {
    status: {
      type: String,
      enum: Object.values(OrderStatus),
      required: true,
    },
    recipientEmail: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
    },
    recipientName: {
      type: String,
      required: true,
      trim: true,
    },
    subject: {
      type: String,
      required: true,
      trim: true,
    },
    success: {
      type: Boolean,
      required: true,
      default: false,
    },
    sentAt: {
      type: Date,
    },
    attemptedAt: {
      type: Date,
      default: Date.now,
      required: true,
    },
    messageId: {
      type: String,
      trim: true,
    },
    error: {
      type: String,
      trim: true,
    },
    retryCount: {
      type: Number,
      default: 0,
    },
    lastRetriedAt: {
      type: Date,
    },
    lastRetriedBy: {
      type: String,
      trim: true,
    },
  },
  { _id: true, timestamps: false }
);

const OrderStatusHistorySchema = new Schema<IOrderStatusHistory>(
  {
    previousStatus: {
      type: String,
      required: true,
      trim: true,
    },
    newStatus: {
      type: String,
      required: true,
      trim: true,
    },
    changedByUserId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    changedByName: {
      type: String,
      trim: true,
    },
    changedByRole: {
      type: String,
      trim: true,
    },
    reason: {
      type: String,
      trim: true,
    },
    note: {
      type: String,
      trim: true,
    },
    timestamp: {
      type: Date,
      default: Date.now,
      required: true,
    },
  },
  { _id: true, timestamps: false }
);

const OrderPaymentSchema = new Schema<IOrderPayment>(
  {
    amountPaise: {
      type: Number,
      required: true,
      min: 1,
    },
    paymentMethod: {
      type: String,
      required: true,
      trim: true,
    },
    referenceNumber: {
      type: String,
      trim: true,
    },
    verifiedByUserId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    verifiedByName: {
      type: String,
      trim: true,
    },
    verifiedByRole: {
      type: String,
      trim: true,
    },
    verifiedAt: {
      type: Date,
      default: Date.now,
      required: true,
    },
    notes: {
      type: String,
      trim: true,
    },
  },
  { _id: true, timestamps: false }
);

const OrderSchema = new Schema<IOrderDocument>(
  {
    orderNumber: {
      type: String,
      required: true,
      unique: true,
      trim: true,
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
      required: true,
    },
    placedByUserId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    placedByName: {
      type: String,
      required: true,
    },
    salesmanId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      index: true,
    },
    status: {
      type: String,
      enum: Object.values(OrderStatus),
      default: OrderStatus.PENDING,
      index: true,
    },
    cancellationReason: {
      type: String,
    },
    items: {
      type: [OrderItemSchema],
      required: true,
      validate: [(val: any[]) => val.length > 0, 'Order must contain at least one item'],
    },
    subtotalPaise: {
      type: Number,
      required: true,
      min: 0,
    },
    totalDiscountPaise: {
      type: Number,
      default: 0,
      min: 0,
    },
    totalProductDiscountPaise: {
      type: Number,
      default: 0,
      min: 0,
    },
    couponCode: {
      type: String,
      trim: true,
      uppercase: true,
    },
    couponDiscountPaise: {
      type: Number,
      default: 0,
      min: 0,
    },
    taxableAmountPaise: {
      type: Number,
      required: true,
      min: 0,
    },
    totalCgstPaise: {
      type: Number,
      default: 0,
      min: 0,
    },
    totalSgstPaise: {
      type: Number,
      default: 0,
      min: 0,
    },
    totalIgstPaise: {
      type: Number,
      default: 0,
      min: 0,
    },
    deliveryFeePaise: {
      type: Number,
      default: 0,
      min: 0,
    },
    grandTotalPaise: {
      type: Number,
      required: true,
      min: 0,
    },
    totalPaidPaise: {
      type: Number,
      default: 0,
      min: 0,
    },
    paymentMethod: {
      type: String,
      enum: Object.values(PaymentMethod),
      required: true,
    },
    paymentStatus: {
      type: String,
      enum: Object.values(PaymentStatus),
      default: PaymentStatus.UNPAID,
      index: true,
    },
    payments: {
      type: [OrderPaymentSchema],
      default: [],
    },
    statusHistory: {
      type: [OrderStatusHistorySchema],
      default: [],
    },
    creditReservationPaise: {
      type: Number,
      default: 0,
      min: 0,
    },
    deliveryAddress: {
      street: { type: String, required: true },
      city: { type: String, required: true },
      state: { type: String, required: true },
      pincode: { type: String, required: true },
      stateCode: { type: String, required: true },
    },
    customerNotes: {
      type: String,
    },
    internalNotes: {
      type: String,
    },
    expectedDeliveryDate: {
      type: Date,
    },
    idempotencyKey: {
      type: String,
      unique: true,
      sparse: true,
    },
    dispatchDetails: {
      dispatchedAt: { type: Date },
      courierName: { type: String, trim: true },
      trackingNumber: { type: String, trim: true },
      trackingUrl: { type: String, trim: true },
      transportDetails: { type: String, trim: true },
    },
    pickupDetails: {
      pickedUpAt: { type: Date },
      pickupLocation: { type: String, trim: true },
      collectedBy: { type: String, trim: true },
      notes: { type: String, trim: true },
    },
    notifications: {
      type: [OrderNotificationSchema],
      default: [],
    },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform: (_doc, ret: any) => {
        ret.id = ret._id.toString();
        ret.totalPaidPaise = ret.totalPaidPaise || 0;
        ret.remainingBalancePaise = Math.max(0, (ret.grandTotalPaise || 0) - ret.totalPaidPaise);
        delete ret._id;
        delete ret.__v;
        return ret;
      },
    },
  }
);

export const Order = mongoose.model<IOrderDocument>('Order', OrderSchema);
