import mongoose, { Schema, Document } from 'mongoose';
import { LedgerEntryType } from '@necessity/shared';

export interface ILedgerEntryDocument extends Document {
  retailerId: mongoose.Types.ObjectId;
  entryNumber: string;
  date: Date;
  type: LedgerEntryType;
  referenceModel: string;
  referenceId?: mongoose.Types.ObjectId | string;
  referenceNumber: string;
  description: string;
  debitPaise: number;
  creditPaise: number;
  runningBalancePaise: number;
  recordedByUserId?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const LedgerEntrySchema = new Schema<ILedgerEntryDocument>(
  {
    retailerId: {
      type: Schema.Types.ObjectId,
      ref: 'Retailer',
      required: true,
      index: true,
    },
    entryNumber: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true,
    },
    date: {
      type: Date,
      required: true,
      default: Date.now,
      index: true,
    },
    type: {
      type: String,
      enum: Object.values(LedgerEntryType),
      required: true,
      index: true,
    },
    referenceModel: {
      type: String,
      required: true,
      trim: true,
      default: 'Manual',
    },
    referenceId: {
      type: Schema.Types.Mixed,
      sparse: true,
    },
    referenceNumber: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    description: {
      type: String,
      required: true,
      trim: true,
    },
    debitPaise: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },
    creditPaise: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },
    runningBalancePaise: {
      type: Number,
      required: true,
      min: 0,
    },
    recordedByUserId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      sparse: true,
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

// Compound indexes for rapid customer ledger statement rendering and chronological integrity
LedgerEntrySchema.index({ retailerId: 1, date: -1, _id: -1 });
LedgerEntrySchema.index({ retailerId: 1, createdAt: 1 });

export const LedgerEntry = mongoose.model<ILedgerEntryDocument>(
  'LedgerEntry',
  LedgerEntrySchema
);
