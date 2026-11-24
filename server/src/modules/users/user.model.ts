import mongoose, { Schema, Document } from 'mongoose';
import bcrypt from 'bcryptjs';
import { UserRole, AccountStatus } from '@necessity/shared';
import { AUTH_SETTINGS } from '../../constants';

export interface IUserDocument extends Document {
  email?: string;
  phone: string;
  name: string;
  passwordHash: string;
  role: UserRole;
  accountStatus: AccountStatus;
  failedLoginAttempts: number;
  lockoutUntil?: Date | null;
  currentRefreshSessionId?: string;
  retailerProfileId?: mongoose.Types.ObjectId;
  assignedTerritoryIds?: mongoose.Types.ObjectId[];
  createdAt: Date;
  updatedAt: Date;
  comparePassword(candidate: string): Promise<boolean>;
  isLocked(): boolean;
  incrementFailedLogins(): Promise<void>;
  resetFailedLogins(): Promise<void>;
}

const UserSchema = new Schema<IUserDocument>(
  {
    email: {
      type: String,
      lowercase: true,
      trim: true,
      sparse: true,
      index: true,
    },
    phone: {
      type: String,
      required: true,
      trim: true,
      unique: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    passwordHash: {
      type: String,
      required: true,
    },
    role: {
      type: String,
      enum: Object.values(UserRole),
      default: UserRole.RETAILER,
      required: true,
      index: true,
    },
    accountStatus: {
      type: String,
      enum: Object.values(AccountStatus),
      default: AccountStatus.PENDING,
      required: true,
      index: true,
    },
    failedLoginAttempts: {
      type: Number,
      default: 0,
    },
    lockoutUntil: {
      type: Date,
      default: null,
    },
    currentRefreshSessionId: {
      type: String,
      sparse: true,
    },
    retailerProfileId: {
      type: Schema.Types.ObjectId,
      ref: 'Retailer',
      sparse: true,
    },
    assignedTerritoryIds: [
      {
        type: Schema.Types.ObjectId,
        ref: 'Territory',
      },
    ],
  },
  {
    timestamps: true,
  }
);

// Method to verify password
UserSchema.methods.comparePassword = async function (candidate: string): Promise<boolean> {
  return bcrypt.compare(candidate, this.passwordHash);
};

// Check if currently locked
UserSchema.methods.isLocked = function (): boolean {
  return !!(this.lockoutUntil && this.lockoutUntil > new Date());
};

// Increment failed attempts and trigger lockout if limit reached
UserSchema.methods.incrementFailedLogins = async function (): Promise<void> {
  this.failedLoginAttempts = (this.failedLoginAttempts || 0) + 1;
  if (this.failedLoginAttempts >= AUTH_SETTINGS.MAX_FAILED_ATTEMPTS) {
    this.lockoutUntil = new Date(Date.now() + AUTH_SETTINGS.LOCKOUT_DURATION_MS);
  }
  await this.save();
};

// Reset failed attempts on successful login
UserSchema.methods.resetFailedLogins = async function (): Promise<void> {
  this.failedLoginAttempts = 0;
  this.lockoutUntil = null;
  await this.save();
};

export const User = mongoose.model<IUserDocument>('User', UserSchema);
