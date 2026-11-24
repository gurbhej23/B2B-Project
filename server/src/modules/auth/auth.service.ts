import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import { User } from '../users/user.model';
import { Retailer } from '../retailers/retailer.model';
import { TokenService, JwtTokenPayload } from './token.service';
import { AuditService } from '../audit/audit.service';
import { AppError } from '../../utils/errors';
import { UserRole, AccountStatus, CreditStatus } from '@necessity/shared';

export interface RegisterRetailerInput {
  businessName: string;
  tradeName?: string;
  contactPerson: string;
  phone: string;
  email?: string;
  password: string;
  gstin?: string;
  pan?: string;
  billingAddress: {
    street: string;
    city: string;
    state: string;
    pincode: string;
    stateCode: string;
  };
  deliveryAddress?: {
    street: string;
    city: string;
    state: string;
    pincode: string;
    stateCode: string;
  };
}

export class AuthService {
  static async registerRetailer(
    input: RegisterRetailerInput,
    ip?: string,
    userAgent?: string
  ) {
    const normalizedPhone = input.phone.trim();
    const normalizedEmail = input.email ? input.email.toLowerCase().trim() : undefined;

    // Check duplicate phone
    const existingPhone = await User.findOne({ phone: normalizedPhone });
    if (existingPhone) {
      throw AppError.conflict('An account with this phone number already exists.');
    }

    // Check duplicate email if provided
    if (normalizedEmail) {
      const existingEmail = await User.findOne({ email: normalizedEmail });
      if (existingEmail) {
        throw AppError.conflict('An account with this email address already exists.');
      }
    }

    // Check duplicate GSTIN if provided
    if (input.gstin && input.gstin.trim()) {
      const existingGstin = await Retailer.findOne({ gstin: input.gstin.trim().toUpperCase() });
      if (existingGstin) {
        throw AppError.conflict('A retailer with this GSTIN is already registered.');
      }
    }

    const contactPerson = (input.contactPerson || (input as any).name || '').trim();
    const billingAddress = input.billingAddress || {
      street: (input as any).address || 'Business Address',
      city: (input as any).city || 'City',
      state: (input as any).state || 'State',
      pincode: (input as any).pincode || '400001',
      stateCode: (input as any).stateCode || '27',
      isDefault: true,
    };

    const salt = await bcrypt.genSalt(12);
    const passwordHash = await bcrypt.hash(input.password, salt);

    let session: mongoose.ClientSession | null = null;
    try {
      const client = (mongoose.connection as any).getClient ? (mongoose.connection as any).getClient() : (mongoose.connection as any).client;
      const supportsTransactions = Boolean(
        client?.topology?.description?.type?.toLowerCase().includes('replicaset')
      );
      if (supportsTransactions) {
        session = await mongoose.startSession();
        session.startTransaction();
      }
    } catch {
      session = null;
    }

    try {
      const user = new User({
        name: contactPerson,
        phone: normalizedPhone,
        email: normalizedEmail,
        passwordHash,
        role: UserRole.RETAILER,
        accountStatus: AccountStatus.PENDING,
      });

      if (session) await user.save({ session });
      else await user.save();

      const deliveryAddresses = input.deliveryAddress
        ? [{ ...input.deliveryAddress, isDefault: true }]
        : [{ ...billingAddress, isDefault: true }];

      const retailer = new Retailer({
        userId: user._id,
        businessName: input.businessName.trim(),
        businessType: (input as any).businessType || 'Retailer',
        tradeName: input.tradeName?.trim(),
        contactPerson,
        phone: normalizedPhone,
        email: normalizedEmail,
        gstin: input.gstin ? input.gstin.trim().toUpperCase() : undefined,
        pan: input.pan ? input.pan.trim().toUpperCase() : undefined,
        billingAddress,
        deliveryAddresses,
        businessDocuments: Array.isArray((input as any).businessDocuments)
          ? (input as any).businessDocuments.filter(
              (doc: any) => doc && doc.documentType && doc.documentType.trim().length > 0
            )
          : [],
        customerType: 'new',
        requestedCustomerType: (input as any).requestedCustomerType || (input as any).customerType || 'retailer',
        isActive: true,
        approvalNotificationStatus: 'pending',
        creditLimitPaise: 0,
        paymentTermsDays: 15,
        creditStatus: CreditStatus.NORMAL,
      });

      if (session) await retailer.save({ session });
      else await retailer.save();

      user.retailerProfileId = retailer._id as mongoose.Types.ObjectId;
      if (session) await user.save({ session });
      else await user.save();

      if (session && session.inTransaction()) {
        await session.commitTransaction();
      }

      await AuditService.log({
        actorId: user._id.toString(),
        action: 'RETAILER_REGISTERED',
        targetResource: 'retailers',
        targetId: retailer._id.toString(),
        details: { businessName: input.businessName, phone: normalizedPhone, customerType: 'new' },
        ipAddress: ip,
        userAgent,
      });

      const sessionId = TokenService.generateSessionId();
      user.currentRefreshSessionId = sessionId;
      await user.save();

      const payload: JwtTokenPayload = {
        sub: user._id.toString(),
        role: user.role,
        sessionId,
        retailerProfileId: retailer._id.toString(),
      };

      const accessToken = TokenService.generateAccessToken(payload);
      const refreshToken = TokenService.generateRefreshToken(payload);

      return {
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          phone: user.phone,
          role: user.role,
          accountStatus: user.accountStatus,
          retailerProfileId: retailer._id,
        },
        retailer: {
          id: retailer._id,
          businessName: retailer.businessName,
          businessType: retailer.businessType,
          accountStatus: user.accountStatus,
          customerType: retailer.customerType,
          isActive: retailer.isActive,
        },
        tokens: {
          accessToken,
          refreshToken,
        },
        userId: user._id,
        retailerId: retailer._id,
        businessName: retailer.businessName,
        phone: user.phone,
        email: user.email,
        accountStatus: user.accountStatus,
        customerType: retailer.customerType,
        isActive: retailer.isActive,
        message: 'Registration submitted. Your account is awaiting admin approval.',
      };
    } catch (error) {
      if (session && session.inTransaction()) {
        await session.abortTransaction().catch(() => {});
      }
      throw error;
    } finally {
      if (session) {
        await session.endSession().catch(() => {});
      }
    }
  }

  static async login(
    identifier: string,
    candidatePassword: string,
    ip?: string,
    userAgent?: string
  ) {
    const cleanIdentifier = identifier.trim();
    const isEmail = cleanIdentifier.includes('@');

    const user = await User.findOne(
      isEmail ? { email: cleanIdentifier.toLowerCase() } : { phone: cleanIdentifier }
    );

    if (!user) {
      throw AppError.invalidCredentials('Invalid phone/email or password');
    }

    // Check account lockout
    if (user.isLocked()) {
      throw AppError.accountLocked();
    }

    // Verify password
    const isMatch = await user.comparePassword(candidatePassword);
    if (!isMatch) {
      await user.incrementFailedLogins();
      throw AppError.invalidCredentials('Invalid phone/email or password');
    }

    // Reset failed logins
    await user.resetFailedLogins();

    // Check account status
    if (user.accountStatus === AccountStatus.SUSPENDED) {
      throw AppError.customerDisabled('Your account has been disabled. Please contact the administrator.');
    }

    if (user.accountStatus === AccountStatus.REJECTED) {
      throw AppError.customerNotApproved('Your retailer registration request has been rejected. Please contact administrator.');
    }

    // Pending buyers are permitted to log in in restricted mode (cannot view prices or place orders until approved)
    const isPendingApproval = user.accountStatus === AccountStatus.PENDING;

    let retailerProfile: any = null;
    if (user.role === UserRole.RETAILER && user.retailerProfileId) {
      const retailerDoc = await Retailer.findById(user.retailerProfileId);
      if (!retailerDoc || (!isPendingApproval && retailerDoc.isActive === false)) {
        throw AppError.customerDisabled('Your account has been disabled. Please contact the administrator.');
      }
      retailerProfile = {
        id: retailerDoc._id,
        businessName: retailerDoc.businessName,
        gstin: retailerDoc.gstin,
        customerType: retailerDoc.customerType || 'retailer',
        pricingGroupId: retailerDoc.pricingGroupId || null,
        discountGroupId: retailerDoc.discountGroupId || null,
        accountStatus: user.accountStatus,
        isApproved: user.accountStatus === AccountStatus.ACTIVE,
        creditLimitPaise: retailerDoc.creditLimitPaise,
        outstandingReceivablesPaise: retailerDoc.outstandingReceivablesPaise,
        availableCreditPaise: retailerDoc.calculateAvailableCreditPaise(),
        creditStatus: retailerDoc.creditStatus,
        paymentTermsDays: retailerDoc.paymentTermsDays,
      };
    }

    // Generate new session ID and rotate
    const sessionId = TokenService.generateSessionId();
    user.currentRefreshSessionId = sessionId;
    await user.save();

    const payload: JwtTokenPayload = {
      sub: user._id.toString(),
      role: user.role,
      sessionId,
      retailerProfileId: user.retailerProfileId?.toString(),
      assignedTerritoryIds: user.assignedTerritoryIds?.map((id) => id.toString()),
    };

    const accessToken = TokenService.generateAccessToken(payload);
    const refreshToken = TokenService.generateRefreshToken(payload);

    await AuditService.log({
      actorId: user._id.toString(),
      action: 'USER_LOGIN_SUCCESS',
      targetResource: 'users',
      targetId: user._id.toString(),
      ipAddress: ip,
      userAgent,
    });

    return {
      user: {
        id: user._id,
        name: user.name,
        phone: user.phone,
        email: user.email,
        role: user.role,
        accountStatus: user.accountStatus,
        retailerProfileId: user.retailerProfileId,
      },
      retailer: retailerProfile,
      tokens: {
        accessToken,
        refreshToken,
      },
      isPendingApproval,
      accountStatus: user.accountStatus,
    };
  }

  static async refreshTokens(presentedRefreshToken: string) {
    let payload: JwtTokenPayload;
    try {
      payload = TokenService.verifyRefreshToken(presentedRefreshToken);
    } catch {
      throw AppError.unauthorized('Invalid or expired refresh token');
    }

    const user = await User.findById(payload.sub);
    if (!user) {
      throw AppError.unauthorized('User not found');
    }

    // Enforce account status on token refresh before session comparison
    if (user.accountStatus === AccountStatus.SUSPENDED) {
      throw AppError.customerDisabled('Your account has been disabled. Please contact the administrator.');
    }

    if (user.role === UserRole.RETAILER) {
      if (user.accountStatus === AccountStatus.REJECTED) {
        throw AppError.customerNotApproved('Your retailer registration request was rejected by the administrator.');
      }

      if (user.retailerProfileId) {
        const retailer = await Retailer.findById(user.retailerProfileId).select('isActive');
        if (!retailer || (user.accountStatus !== AccountStatus.PENDING && retailer.isActive === false)) {
          throw AppError.customerDisabled('Your account has been disabled. Please contact the administrator.');
        }
      }
    }

    // Refresh token reuse detection:
    // If the presented token's sessionId doesn't match the active sessionId in the DB,
    // a token theft/replay has occurred. Revoke the session immediately!
    if (user.currentRefreshSessionId !== payload.sessionId) {
      user.currentRefreshSessionId = undefined;
      await user.save();
      throw AppError.unauthorized('Compromised or reused session token detected. Please sign in again.');
    }

    // Issue a brand new session ID (token rotation)
    const newSessionId = TokenService.generateSessionId();
    user.currentRefreshSessionId = newSessionId;
    await user.save();

    const newPayload: JwtTokenPayload = {
      sub: user._id.toString(),
      role: user.role,
      sessionId: newSessionId,
      retailerProfileId: user.retailerProfileId?.toString(),
      assignedTerritoryIds: user.assignedTerritoryIds?.map((id) => id.toString()),
    };

    const newAccessToken = TokenService.generateAccessToken(newPayload);
    const newRefreshToken = TokenService.generateRefreshToken(newPayload);

    return {
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
    };
  }

  static async logout(userId: string) {
    const user = await User.findById(userId);
    if (user) {
      user.currentRefreshSessionId = undefined;
      await user.save();
    }
  }

  static async updateProfile(userId: string, input: { name?: string; email?: string }) {
    const user = await User.findById(userId);
    if (!user) {
      throw AppError.notFound('User not found');
    }

    if (input.name && input.name.trim().length >= 2) {
      user.name = input.name.trim();
    }

    if (input.email !== undefined && input.email.trim() !== '') {
      const normalizedEmail = input.email.trim().toLowerCase();
      if (normalizedEmail !== user.email) {
        const existing = await User.findOne({ email: normalizedEmail, _id: { $ne: user._id } });
        if (existing) {
          throw AppError.conflict('An account with this email address already exists');
        }
        user.email = normalizedEmail;
      }
    }

    await user.save();

    if (user.retailerProfileId) {
      const retailer = await Retailer.findById(user.retailerProfileId);
      if (retailer) {
        if (input.name) retailer.contactPerson = user.name;
        if (user.email) retailer.email = user.email;
        await retailer.save();
      }
    }

    return AuthService.getMe(userId);
  }

  static async changePassword(userId: string, currentPass: string, newPass: string) {
    const user = await User.findById(userId);
    if (!user) {
      throw AppError.notFound('User not found');
    }

    const isMatch = await user.comparePassword(currentPass);
    if (!isMatch) {
      throw AppError.badRequest('Current password does not match our records');
    }

    if (newPass.length < 8) {
      throw AppError.badRequest('New password must be at least 8 characters long');
    }

    user.passwordHash = await bcrypt.hash(newPass, 12);
    // Rotate session ID so any other sessions must re-authenticate
    user.currentRefreshSessionId = TokenService.generateSessionId();
    await user.save();
  }

  static async getMe(userId: string) {
    const user = await User.findById(userId).select('-passwordHash');
    if (!user) {
      throw AppError.notFound('User not found');
    }

    if (user.accountStatus === AccountStatus.SUSPENDED) {
      throw AppError.customerDisabled('Your account has been disabled. Please contact the administrator.');
    }

    let retailer: any = null;
    if (user.retailerProfileId) {
      const retailerDoc = await Retailer.findById(user.retailerProfileId);
      if (retailerDoc) {
        if (retailerDoc.isActive === false) {
          throw AppError.customerDisabled('Your account has been disabled. Please contact the administrator.');
        }
        retailer = {
          id: retailerDoc._id,
          businessName: retailerDoc.businessName,
          tradeName: retailerDoc.tradeName,
          gstin: retailerDoc.gstin,
          pan: retailerDoc.pan,
          billingAddress: retailerDoc.billingAddress,
          deliveryAddresses: retailerDoc.deliveryAddresses,
          customerType: retailerDoc.customerType || 'retailer',
          pricingGroupId: retailerDoc.pricingGroupId || null,
          discountGroupId: retailerDoc.discountGroupId || null,
          creditLimitPaise: retailerDoc.creditLimitPaise,
          outstandingReceivablesPaise: retailerDoc.outstandingReceivablesPaise,
          activeReservationsPaise: retailerDoc.activeReservationsPaise,
          availableCreditPaise: retailerDoc.calculateAvailableCreditPaise(),
          creditStatus: retailerDoc.creditStatus,
          paymentTermsDays: retailerDoc.paymentTermsDays,
        };
      }
    }

    return {
      user: {
        id: user._id,
        name: user.name,
        phone: user.phone,
        email: user.email,
        role: user.role,
        accountStatus: user.accountStatus,
        assignedTerritoryIds: user.assignedTerritoryIds,
      },
      retailer,
    };
  }

  static async checkStatus(identifier?: string, userId?: string) {
    if (!identifier && !userId) {
      throw AppError.badRequest('Please provide an email or phone number to check approval status.');
    }

    let user: any = null;
    if (userId) {
      user = await User.findById(userId);
    } else if (identifier) {
      const cleanIdentifier = identifier.trim();
      const isEmail = cleanIdentifier.includes('@');
      user = await User.findOne(
        isEmail ? { email: cleanIdentifier.toLowerCase() } : { phone: cleanIdentifier }
      );
    }

    if (!user) {
      throw AppError.notFound('No registered account found with this email or phone number.');
    }

    let retailer: any = null;
    if (user.retailerProfileId) {
      retailer = await Retailer.findById(user.retailerProfileId);
    } else {
      retailer = await Retailer.findOne({ userId: user._id });
    }

    const isApproved = user.accountStatus === AccountStatus.ACTIVE;

    return {
      name: user.name,
      email: user.email,
      phone: user.phone,
      businessName: retailer?.businessName || '',
      accountStatus: user.accountStatus,
      isApproved,
      rejectionReason: retailer?.rejectionReason || null,
      message: isApproved
        ? 'Your account has been approved by the administrator. You can now login.'
        : user.accountStatus === AccountStatus.PENDING
        ? 'Your application is awaiting administrator approval.'
        : user.accountStatus === AccountStatus.REJECTED
        ? `Your registration was rejected: ${retailer?.rejectionReason || 'Contact administration.'}`
        : 'Your account is deactivated.',
    };
  }

  /**
   * Super Admin authorized workflow to create additional staff accounts.
   */
  static async createStaffUser(
    input: {
      name: string;
      email: string;
      phone: string;
      password: string;
      role: UserRole;
    },
    currentUser: any
  ) {
    if (currentUser.role !== UserRole.SUPER_ADMIN) {
      throw AppError.forbidden('Only Super Admin can create staff accounts.');
    }

    const allowedStaffRoles = [
      UserRole.ADMIN,
      UserRole.ACCOUNTS_MANAGER,
      UserRole.SALES_MANAGER,
      UserRole.SALESMAN,
      UserRole.WAREHOUSE_MANAGER,
    ];

    if (!allowedStaffRoles.includes(input.role)) {
      throw AppError.badRequest(
        `Invalid staff role '${input.role}'. Allowed roles: ${allowedStaffRoles.join(', ')}`
      );
    }

    const normalizedEmail = input.email.toLowerCase().trim();
    const normalizedPhone = input.phone.trim();

    const existingEmail = await User.findOne({ email: normalizedEmail });
    if (existingEmail) {
      throw AppError.conflict('A user with this email address already exists.');
    }

    const existingPhone = await User.findOne({ phone: normalizedPhone });
    if (existingPhone) {
      throw AppError.conflict('A user with this phone number already exists.');
    }

    const salt = await bcrypt.genSalt(12);
    const passwordHash = await bcrypt.hash(input.password, salt);

    const user = await User.create({
      name: input.name.trim(),
      email: normalizedEmail,
      phone: normalizedPhone,
      passwordHash,
      role: input.role,
      accountStatus: AccountStatus.ACTIVE,
    });

    await AuditService.log({
      actorId: (currentUser.id || currentUser._id).toString(),
      action: 'STAFF_USER_CREATED',
      targetResource: 'users',
      targetId: user._id.toString(),
      details: {
        createdUserId: user._id.toString(),
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
      },
    });

    return {
      id: user._id.toString(),
      name: user.name,
      email: user.email,
      phone: user.phone,
      role: user.role,
      accountStatus: user.accountStatus,
      createdAt: user.createdAt,
    };
  }
}

