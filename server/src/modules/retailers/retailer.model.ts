import mongoose, { Schema, Document } from 'mongoose';
import { CreditStatus, CustomerType } from '@necessity/shared';

export interface IAddressSubdocument {
  street: string;
  city: string;
  state: string;
  pincode: string;
  stateCode: string;
  isDefault?: boolean;
}

export interface IRetailerDocument extends Document {
  userId: mongoose.Types.ObjectId;
  businessName: string;
  businessType?: string;
  tradeName?: string;
  gstin?: string;
  pan?: string;
  contactPerson: string;
  phone: string;
  email?: string;
  billingAddress: IAddressSubdocument;
  deliveryAddresses: IAddressSubdocument[];
  businessDocuments?: Array<{
    documentType: string;
    documentNumber?: string;
    fileUrl?: string;
    fileName?: string;
    uploadedAt?: Date;
  }>;
  creditLimitPaise: number;
  paymentTermsDays: number;
  creditStatus: CreditStatus;
  creditHoldReason?: string;
  customerType: CustomerType;
  requestedCustomerType?: string;
  pricingGroupId?: mongoose.Types.ObjectId | null;
  discountGroupId?: mongoose.Types.ObjectId | null;
  isActive: boolean;
  rejectionReason?: string;
  approvalEmailSentAt?: Date;
  approvalNotificationStatus?: 'pending' | 'sent' | 'failed';
  assignedSalesmanId?: mongoose.Types.ObjectId;
  assignedTerritoryId?: mongoose.Types.ObjectId;
  outstandingReceivablesPaise: number;
  activeReservationsPaise: number;
  approvedAt?: Date;
  approvedBy?: mongoose.Types.ObjectId;
  isArchived?: boolean;
  archivedAt?: Date;
  archivedBy?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
  calculateAvailableCreditPaise(): number;
}

const AddressSchema = new Schema(
  {
    street: { type: String, required: true },
    city: { type: String, required: true },
    state: { type: String, required: true },
    pincode: { type: String, required: true },
    stateCode: { type: String, required: true },
    isDefault: { type: Boolean, default: false },
  },
  { _id: false }
);

const RetailerSchema = new Schema<IRetailerDocument>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
      index: true,
    },
    businessName: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    businessType: {
      type: String,
      trim: true,
      default: 'Retailer',
    },
    tradeName: {
      type: String,
      trim: true,
    },
    gstin: {
      type: String,
      uppercase: true,
      trim: true,
      sparse: true,
      index: true,
    },
    pan: {
      type: String,
      uppercase: true,
      trim: true,
      sparse: true,
    },
    contactPerson: {
      type: String,
      required: true,
      trim: true,
    },
    phone: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    email: {
      type: String,
      lowercase: true,
      trim: true,
    },
    billingAddress: {
      type: AddressSchema,
      required: true,
    },
    deliveryAddresses: {
      type: [AddressSchema],
      default: [],
    },
    businessDocuments: [
      {
        documentType: { type: String, required: true },
        documentNumber: { type: String, trim: true },
        fileUrl: { type: String, trim: true },
        fileName: { type: String, trim: true },
        uploadedAt: { type: Date, default: Date.now },
      },
    ],
    creditLimitPaise: {
      type: Number,
      default: 0,
    },
    paymentTermsDays: {
      type: Number,
      default: 15,
    },
    creditStatus: {
      type: String,
      enum: Object.values(CreditStatus),
      default: CreditStatus.NORMAL,
      index: true,
    },
    creditHoldReason: {
      type: String,
    },
    assignedSalesmanId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      index: true,
    },
    assignedTerritoryId: {
      type: Schema.Types.ObjectId,
      ref: 'Territory',
      index: true,
    },
    outstandingReceivablesPaise: {
      type: Number,
      default: 0,
    },
    activeReservationsPaise: {
      type: Number,
      default: 0,
    },
    customerType: {
      type: String,
      enum: Object.values(CustomerType),
      default: CustomerType.RETAILER,
      index: true,
    },
    requestedCustomerType: {
      type: String,
      trim: true,
    },
    pricingGroupId: {
      type: Schema.Types.ObjectId,
      ref: 'PricingGroup',
      default: null,
      index: true,
    },
    discountGroupId: {
      type: Schema.Types.ObjectId,
      ref: 'DiscountGroup',
      default: null,
      index: true,
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    rejectionReason: {
      type: String,
      trim: true,
    },
    approvalEmailSentAt: {
      type: Date,
    },
    approvalNotificationStatus: {
      type: String,
      enum: ['pending', 'sent', 'failed'],
      default: 'pending',
    },
    approvedAt: {
      type: Date,
      index: true,
    },
    approvedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    isArchived: {
      type: Boolean,
      default: false,
      index: true,
    },
    archivedAt: {
      type: Date,
    },
    archivedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
  },
  {
    timestamps: true,
  }
);

// Authoritative Available Credit calculation:
// Available Credit = Approved Credit Limit - Outstanding Receivables - Active Reservations
RetailerSchema.methods.calculateAvailableCreditPaise = function (): number {
  if (this.creditStatus === CreditStatus.ON_HOLD || this.creditStatus === CreditStatus.RESTRICTED) {
    return 0;
  }
  const available =
    (this.creditLimitPaise || 0) -
    (this.outstandingReceivablesPaise || 0) -
    (this.activeReservationsPaise || 0);
  return Math.max(0, available);
};

export const Retailer = mongoose.model<IRetailerDocument>('Retailer', RetailerSchema);
