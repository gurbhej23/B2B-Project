import mongoose from 'mongoose';
import { Retailer, IRetailerDocument } from './retailer.model';
import { User } from '../users/user.model';
import { Order } from '../orders/order.model';
import { AuditService } from '../audit/audit.service';
import { EmailService, EmailSendResult } from '../email/email.service';
import { AppError } from '../../utils/errors';
import { escapeRegex } from '../../utils/security';
import { AccountStatus, CreditStatus, CustomerType, UserRole } from '@necessity/shared';

export interface RetailerApprovalInput {
  status: AccountStatus;
  customerType?: CustomerType;
  pricingGroupId?: string | null;
  discountGroupId?: string | null;
  creditLimitPaise?: number;
  paymentTermsDays?: number;
  creditStatus?: CreditStatus;
  creditHoldReason?: string;
  assignedSalesmanId?: string;
  rejectionReason?: string;
}

export class RetailerService {
  static async getPendingRetailers(page: number = 1, limit: number = 20) {
    const skip = (page - 1) * limit;

    // Find users with role RETAILER and accountStatus PENDING
    const pendingUsers = await User.find({
      role: UserRole.RETAILER,
      accountStatus: AccountStatus.PENDING,
    })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await User.countDocuments({
      role: UserRole.RETAILER,
      accountStatus: AccountStatus.PENDING,
    });

    const retailerProfileIds = pendingUsers.map((u) => u.retailerProfileId).filter(Boolean);
    const retailers = await Retailer.find({ _id: { $in: retailerProfileIds } });
    const retailerMap = new Map(retailers.map((r) => [r._id.toString(), r]));

    const combined = pendingUsers.map((u) => {
      const profile = u.retailerProfileId ? retailerMap.get(u.retailerProfileId.toString()) : null;
      return {
        userId: u._id,
        retailerId: profile?._id,
        businessName: profile?.businessName || 'N/A',
        tradeName: profile?.tradeName,
        contactPerson: u.name,
        phone: u.phone,
        email: u.email,
        gstin: profile?.gstin,
        pan: profile?.pan,
        billingAddress: profile?.billingAddress,
        deliveryAddresses: profile?.deliveryAddresses,
        customerType: profile?.customerType || CustomerType.NEW,
        isActive: profile?.isActive ?? true,
        accountStatus: u.accountStatus,
        createdAt: u.createdAt,
      };
    });

    return { data: combined, total, page, limit };
  }

  static async listRetailers(
    query: {
      search?: string;
      status?: AccountStatus;
      customerType?: CustomerType;
      isActive?: boolean | string;
      creditStatus?: CreditStatus;
      includeArchived?: boolean | string;
      page?: number;
      limit?: number;
    },
    currentUser?: any
  ) {
    const page = Number(query.page) || 1;
    const limit = Number(query.limit) || 20;
    const skip = (page - 1) * limit;

    const andConditions: any[] = [];

    // Role-based scoping (prevent cross-territory access)
    if (currentUser) {
      if (currentUser.role === UserRole.RETAILER) {
        if (!currentUser.retailerProfileId) {
          return { data: [], total: 0, page, limit };
        }
        andConditions.push({ _id: new mongoose.Types.ObjectId(currentUser.retailerProfileId) });
      } else if (currentUser.role === UserRole.SALESMAN) {
        andConditions.push({ assignedSalesmanId: new mongoose.Types.ObjectId(currentUser._id || currentUser.id) });
      }
    }

    if (query.customerType) {
      andConditions.push({ customerType: query.customerType });
    }

    if (query.isActive !== undefined && query.isActive !== '') {
      const activeBool = query.isActive === true || query.isActive === 'true';
      andConditions.push({ isActive: activeBool });
    }

    if (query.creditStatus) {
      andConditions.push({ creditStatus: query.creditStatus });
    }

    // Exclude safely archived customers unless explicitly requested
    if (query.includeArchived !== true && query.includeArchived !== 'true') {
      andConditions.push({ isArchived: { $ne: true } });
    }

    // Filter by Account Status (which lives on the User model)
    if (query.status) {
      const matchingUsers = await User.find({ accountStatus: query.status }).select('_id');
      const userIds = matchingUsers.map((u) => u._id);
      andConditions.push({ userId: { $in: userIds } });
    }

    if (query.search && query.search.trim()) {
      const searchRegex = new RegExp(escapeRegex(query.search.trim()), 'i');
      andConditions.push({
        $or: [
          { businessName: searchRegex },
          { contactPerson: searchRegex },
          { phone: searchRegex },
          { email: searchRegex },
          { gstin: searchRegex },
        ],
      });
    }

    const filter = andConditions.length > 0 ? { $and: andConditions } : {};

    const [retailers, total] = await Promise.all([
      Retailer.find(filter)
        .populate('userId', 'email phone name accountStatus failedLoginAttempts')
        .populate('assignedSalesmanId', 'name phone')
        .populate('pricingGroupId', 'name code')
        .populate('discountGroupId', 'name code')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Retailer.countDocuments(filter),
    ]);

    const formatted = retailers.map((r: any) => ({
      id: r._id,
      userId: r.userId?._id,
      businessName: r.businessName,
      tradeName: r.tradeName,
      contactPerson: r.contactPerson,
      phone: r.phone,
      email: r.email || r.userId?.email,
      gstin: r.gstin,
      pan: r.pan,
      billingAddress: r.billingAddress,
      creditLimitPaise: r.creditLimitPaise,
      paymentTermsDays: r.paymentTermsDays,
      creditStatus: r.creditStatus,
      creditHoldReason: r.creditHoldReason,
      customerType: r.customerType || CustomerType.RETAILER,
      pricingGroupId: r.pricingGroupId?._id || r.pricingGroupId || null,
      pricingGroupName: r.pricingGroupId?.name || null,
      pricingGroupCode: r.pricingGroupId?.code || null,
      discountGroupId: r.discountGroupId?._id || r.discountGroupId || null,
      discountGroupName: r.discountGroupId?.name || null,
      discountGroupCode: r.discountGroupId?.code || null,
      isActive: r.isActive ?? true,
      rejectionReason: r.rejectionReason,
      approvalEmailSentAt: r.approvalEmailSentAt,
      approvalNotificationStatus: r.approvalNotificationStatus,
      outstandingReceivablesPaise: r.outstandingReceivablesPaise,
      activeReservationsPaise: r.activeReservationsPaise,
      availableCreditPaise: r.calculateAvailableCreditPaise(),
      accountStatus: r.userId?.accountStatus,
      assignedSalesman: (() => {
        const salesman = r.assignedSalesmanId as any;
        return salesman && typeof salesman === 'object' && ('_id' in salesman || 'name' in salesman)
          ? { id: (salesman._id || salesman.id)?.toString(), name: salesman.name || '' }
          : null;
      })(),
      approvedAt: r.approvedAt,
      approvedBy: r.approvedBy,
      createdAt: r.createdAt,
    }));

    return { data: formatted, total, page, limit };
  }

  static async getRetailerById(retailerId: string, currentUser?: any) {
    if (!mongoose.Types.ObjectId.isValid(retailerId)) {
      throw AppError.badRequest('Invalid retailer ID format');
    }

    const retailer = await Retailer.findById(retailerId)
      .populate('userId', 'email phone name accountStatus failedLoginAttempts')
      .populate('assignedSalesmanId', 'name phone email')
      .populate('pricingGroupId', 'name code')
      .populate('discountGroupId', 'name code')
      .populate('approvedBy', 'name email');

    if (!retailer) {
      throw AppError.notFound('Retailer profile not found');
    }

    // Role-based record ownership & authorization checks (prevent IDOR)
    if (currentUser) {
      if (currentUser.role === UserRole.RETAILER) {
        if (
          !currentUser.retailerProfileId ||
          currentUser.retailerProfileId.toString() !== retailer._id.toString()
        ) {
          throw AppError.forbidden('You do not have permission to view other retailers');
        }
      } else if (currentUser.role === UserRole.SALESMAN) {
        const assignedSalesmanIdStr = (retailer.assignedSalesmanId as any)?._id?.toString() ||
          retailer.assignedSalesmanId?.toString();
        const currentUserIdStr = (currentUser._id || currentUser.id).toString();

        if (assignedSalesmanIdStr !== currentUserIdStr) {
          throw AppError.forbidden('You are not authorized to view retailers outside your assigned territory');
        }
      }
    }

    const userObj = retailer.userId as any;
    return {
      ...retailer.toObject(),
      accountStatus: userObj?.accountStatus || AccountStatus.PENDING,
      customerType: retailer.customerType || CustomerType.NEW,
      isActive: retailer.isActive ?? true,
      availableCreditPaise: retailer.calculateAvailableCreditPaise(),
    };
  }

  static async updateApproval(
    retailerId: string,
    input: RetailerApprovalInput,
    approverUserId: string,
    ip?: string,
    userAgent?: string
  ) {
    if (!mongoose.Types.ObjectId.isValid(retailerId)) {
      throw AppError.badRequest('Invalid retailer ID format');
    }

    const retailer = await Retailer.findById(retailerId);
    if (!retailer) {
      throw AppError.notFound('Retailer profile not found');
    }

    const user = await User.findById(retailer.userId);
    if (!user) {
      throw AppError.notFound('Associated user account not found');
    }

    const previousStatus = user.accountStatus;
    const isApproving = input.status === AccountStatus.ACTIVE;
    const isRejecting = input.status === AccountStatus.REJECTED;

    // Update User account status
    user.accountStatus = input.status;

    // Invalidate sessions if rejected or suspended
    if (input.status === AccountStatus.REJECTED || input.status === AccountStatus.SUSPENDED) {
      user.currentRefreshSessionId = undefined;
    }
    await user.save();

    // Update Retailer fields
    if (input.customerType) {
      retailer.customerType = input.customerType;
    }
    if ((input as any).pricingGroupId !== undefined) {
      retailer.pricingGroupId = (input as any).pricingGroupId && mongoose.Types.ObjectId.isValid((input as any).pricingGroupId)
        ? new mongoose.Types.ObjectId((input as any).pricingGroupId)
        : null;
    }
    if ((input as any).discountGroupId !== undefined) {
      retailer.discountGroupId = (input as any).discountGroupId && mongoose.Types.ObjectId.isValid((input as any).discountGroupId)
        ? new mongoose.Types.ObjectId((input as any).discountGroupId)
        : null;
    }
    if (input.creditLimitPaise !== undefined) {
      retailer.creditLimitPaise = input.creditLimitPaise;
    }
    if (input.paymentTermsDays !== undefined) {
      retailer.paymentTermsDays = input.paymentTermsDays;
    }
    if (input.creditStatus) {
      retailer.creditStatus = input.creditStatus;
    }
    if (input.creditHoldReason !== undefined) {
      retailer.creditHoldReason = input.creditHoldReason;
    }
    if (input.assignedSalesmanId) {
      retailer.assignedSalesmanId = input.assignedSalesmanId as any;
    }

    let emailResult: any = null;

    if (isApproving) {
      retailer.approvedAt = new Date();
      retailer.approvedBy = approverUserId as any;
      retailer.isActive = true;
      retailer.rejectionReason = undefined;

      // Send approval notification email (safe, non-blocking)
      const recipientEmail = (retailer.email || user.email || '').trim();
      if (recipientEmail) {
        // Send approval email if not already successfully sent, or if status changed
        if (!retailer.approvalEmailSentAt || retailer.approvalNotificationStatus !== 'sent' || input.status !== previousStatus) {
          emailResult = await EmailService.sendApprovalEmail({
            to: recipientEmail,
            customerName: user.name || retailer.contactPerson,
            businessName: retailer.businessName,
            customerType: retailer.customerType || CustomerType.NEW,
          });

          if (emailResult.success) {
            retailer.approvalEmailSentAt = new Date();
            retailer.approvalNotificationStatus = 'sent';
          } else {
            retailer.approvalNotificationStatus = 'failed';
          }
        }
      } else {
        emailResult = {
          success: false,
          skipped: true,
          error: 'No email address registered for this customer account.',
        };
      }
    } else if (isRejecting) {
      retailer.isActive = false;
      retailer.rejectionReason = input.rejectionReason || 'Application criteria not met';

      const recipientEmail = retailer.email || user.email;
      if (recipientEmail) {
        emailResult = await EmailService.sendRejectionEmail({
          to: recipientEmail,
          customerName: user.name || retailer.contactPerson,
          businessName: retailer.businessName,
          reason: retailer.rejectionReason,
        });
      }
    }

    await retailer.save();

    await AuditService.log({
      actorId: approverUserId,
      action: isApproving
        ? 'CUSTOMER_APPROVED'
        : isRejecting
          ? 'CUSTOMER_REJECTED'
          : 'RETAILER_APPROVAL_STATUS_CHANGED',
      targetResource: 'retailers',
      targetId: retailerId,
      details: {
        previousStatus,
        newStatus: input.status,
        customerType: retailer.customerType,
        rejectionReason: retailer.rejectionReason,
        emailResult: emailResult ? { success: emailResult.success, error: emailResult.error } : null,
      },
      ipAddress: ip,
      userAgent,
    });

    return {
      retailerId: retailer._id,
      userId: user._id,
      accountStatus: user.accountStatus,
      customerType: retailer.customerType,
      isActive: retailer.isActive,
      creditLimitPaise: retailer.creditLimitPaise,
      paymentTermsDays: retailer.paymentTermsDays,
      availableCreditPaise: retailer.calculateAvailableCreditPaise(),
      approvedAt: retailer.approvedAt,
      rejectionReason: retailer.rejectionReason,
      emailNotification: emailResult,
    };
  }

  /**
   * Change Customer Type (New / Old) with audit logging
   */
  static async updateCustomerType(
    retailerId: string,
    customerType: CustomerType,
    actorId: string,
    ip?: string,
    userAgent?: string,
    extraData?: {
      pricingGroupId?: string | null;
      discountGroupId?: string | null;
      creditLimitPaise?: number;
      paymentTermsDays?: number;
      creditStatus?: CreditStatus;
    }
  ) {
    if (!mongoose.Types.ObjectId.isValid(retailerId)) {
      throw AppError.badRequest('Invalid retailer ID format');
    }

    const retailer = await Retailer.findById(retailerId);
    if (!retailer) {
      throw AppError.notFound('Customer profile not found');
    }

    const previousType = retailer.customerType || CustomerType.RETAILER;
    retailer.customerType = customerType;

    if (extraData?.pricingGroupId !== undefined) {
      retailer.pricingGroupId =
        extraData.pricingGroupId && mongoose.Types.ObjectId.isValid(extraData.pricingGroupId)
          ? new mongoose.Types.ObjectId(extraData.pricingGroupId)
          : null;
    }
    if (extraData?.discountGroupId !== undefined) {
      retailer.discountGroupId =
        extraData.discountGroupId && mongoose.Types.ObjectId.isValid(extraData.discountGroupId)
          ? new mongoose.Types.ObjectId(extraData.discountGroupId)
          : null;
    }
    if (extraData?.creditLimitPaise !== undefined) {
      retailer.creditLimitPaise = extraData.creditLimitPaise;
    }
    if (extraData?.paymentTermsDays !== undefined) {
      retailer.paymentTermsDays = extraData.paymentTermsDays;
    }
    if (extraData?.creditStatus) {
      retailer.creditStatus = extraData.creditStatus;
    }

    await retailer.save();

    await AuditService.log({
      actorId,
      action: 'CUSTOMER_TYPE_CHANGED',
      targetResource: 'retailers',
      targetId: retailerId,
      details: {
        previousType,
        newType: customerType,
        pricingGroupId: retailer.pricingGroupId,
        discountGroupId: retailer.discountGroupId,
        customerName: retailer.contactPerson,
        businessName: retailer.businessName,
      },
      ipAddress: ip,
      userAgent,
    });

    return {
      retailerId: retailer._id,
      customerType: retailer.customerType,
      pricingGroupId: retailer.pricingGroupId,
      discountGroupId: retailer.discountGroupId,
      businessName: retailer.businessName,
    };
  }

  /**
   * Enable or Disable customer account with session invalidation & audit log.
   * Uses targeted single-document findByIdAndUpdate by validated MongoDB _id.
   * Disabling does NOT alter customer approval status (AccountStatus), customer type, or historical data.
   */
  static async updateCustomerStatus(
    retailerId: string,
    isActive: boolean,
    actorId: string,
    reason?: string,
    ip?: string,
    userAgent?: string
  ) {
    if (!mongoose.Types.ObjectId.isValid(retailerId)) {
      throw AppError.badRequest('Invalid customer ID format');
    }

    const previousRetailer = await Retailer.findById(retailerId);
    if (!previousRetailer) {
      throw AppError.notFound('Customer profile not found');
    }

    const previousActive = previousRetailer.isActive ?? true;

    // Targeted single-document update strictly matching this customer's _id
    const updatedRetailer = await Retailer.findByIdAndUpdate(
      retailerId,
      { $set: { isActive: Boolean(isActive) } },
      { new: true, runValidators: true }
    );

    if (!updatedRetailer) {
      throw AppError.notFound('Customer profile not found');
    }

    // Invalidate active session tokens when disabled, preserving approval status
    let userAccountStatus: AccountStatus | undefined = undefined;
    let user: any = null;
    if (updatedRetailer.userId) {
      user = await User.findById(updatedRetailer.userId);
      if (user) {
        userAccountStatus = user.accountStatus;
        if (!isActive) {
          user.currentRefreshSessionId = undefined;
          await user.save();
        } else {
          // If customer was suspended due to previously being disabled, restore to ACTIVE
          // (Preserves PENDING or REJECTED status so non-approved accounts are not unintentionally approved)
          if (user.accountStatus === AccountStatus.SUSPENDED) {
            user.accountStatus = AccountStatus.ACTIVE;
            userAccountStatus = AccountStatus.ACTIVE;
            await user.save();
          }
        }
      }
    }

    // Trigger notification email to customer
    let emailResult: EmailSendResult | null = null;
    const recipientEmail = updatedRetailer.email || (user ? user.email : undefined);
    const recipientName =
      (user ? user.name : undefined) || updatedRetailer.contactPerson || updatedRetailer.businessName;

    if (recipientEmail) {
      if (!isActive) {
        emailResult = await EmailService.sendAccountDisabledEmail({
          to: recipientEmail,
          customerName: recipientName,
          businessName: updatedRetailer.businessName,
          reason,
        });
      } else {
        emailResult = await EmailService.sendAccountEnabledEmail({
          to: recipientEmail,
          customerName: recipientName,
          businessName: updatedRetailer.businessName,
        });
      }
    } else {
      emailResult = {
        success: false,
        skipped: true,
        error: 'No email address registered for this customer account.',
      };
    }

    await AuditService.log({
      actorId,
      action: isActive ? 'CUSTOMER_ENABLED' : 'CUSTOMER_DISABLED',
      targetResource: 'retailers',
      targetId: retailerId,
      details: {
        previousActive,
        newActive: isActive,
        customerType: updatedRetailer.customerType,
        accountStatus: userAccountStatus,
        reason,
        emailResult: emailResult ? { success: emailResult.success, error: emailResult.error } : null,
      },
      ipAddress: ip,
      userAgent,
    });

    return {
      id: updatedRetailer._id.toString(),
      retailerId: updatedRetailer._id.toString(),
      userId: updatedRetailer.userId?.toString(),
      isActive: updatedRetailer.isActive,
      customerType: updatedRetailer.customerType,
      accountStatus: userAccountStatus,
      businessName: updatedRetailer.businessName,
      contactPerson: updatedRetailer.contactPerson,
      phone: updatedRetailer.phone,
      email: updatedRetailer.email,
      emailNotification: emailResult,
    };
  }

  /**
   * Update Customer Profile Details (Admin only)
   */
  static async updateCustomerDetails(
    retailerId: string,
    data: {
      businessName?: string;
      tradeName?: string;
      contactPerson?: string;
      phone?: string;
      email?: string;
      gstin?: string;
      pan?: string;
      billingAddress?: any;
      isActive?: boolean;
    },
    actorId: string,
    ip?: string,
    userAgent?: string
  ) {
    const retailer = await Retailer.findById(retailerId);
    if (!retailer) {
      throw AppError.notFound('Customer not found');
    }

    // Check phone uniqueness if modified
    if (data.phone && data.phone !== retailer.phone) {
      const cleanPhone = data.phone.trim();
      const existingPhone = await Retailer.findOne({ phone: cleanPhone, _id: { $ne: retailer._id } });
      const existingUserPhone = await User.findOne({ phone: cleanPhone, _id: { $ne: retailer.userId } });
      if (existingPhone || existingUserPhone) {
        throw AppError.conflict('Another customer is already registered with this phone number');
      }
      retailer.phone = cleanPhone;
    }

    // Check email uniqueness if modified
    if (data.email !== undefined) {
      const cleanEmail = data.email?.trim()?.toLowerCase() || undefined;
      if (cleanEmail && cleanEmail !== retailer.email?.toLowerCase()) {
        const existingEmail = await Retailer.findOne({ email: cleanEmail, _id: { $ne: retailer._id } });
        const existingUserEmail = await User.findOne({ email: cleanEmail, _id: { $ne: retailer.userId } });
        if (existingEmail || existingUserEmail) {
          throw AppError.conflict('Another customer is already registered with this email address');
        }
      }
      retailer.email = cleanEmail;
    }

    if (data.businessName !== undefined) retailer.businessName = data.businessName.trim();
    if (data.tradeName !== undefined) retailer.tradeName = data.tradeName.trim() || undefined;
    if (data.contactPerson !== undefined) retailer.contactPerson = data.contactPerson.trim();
    if (data.gstin !== undefined) retailer.gstin = data.gstin.trim()?.toUpperCase() || undefined;
    if (data.pan !== undefined) retailer.pan = data.pan.trim()?.toUpperCase() || undefined;
    if (data.billingAddress !== undefined) {
      retailer.billingAddress = {
        street: data.billingAddress.street?.trim() || retailer.billingAddress?.street || '',
        city: data.billingAddress.city?.trim() || retailer.billingAddress?.city || '',
        state: data.billingAddress.state?.trim() || retailer.billingAddress?.state || '',
        pincode: data.billingAddress.pincode?.trim() || retailer.billingAddress?.pincode || '',
        stateCode: data.billingAddress.stateCode?.trim() || retailer.billingAddress?.stateCode || '27',
      };
    }
    if (data.isActive !== undefined) {
      retailer.isActive = data.isActive;
    }

    await retailer.save();

    // Also keep linked User in sync
    if (retailer.userId) {
      const user = await User.findById(retailer.userId);
      if (user) {
        if (data.contactPerson !== undefined) user.name = data.contactPerson.trim();
        if (data.phone !== undefined) user.phone = data.phone.trim();
        if (data.email !== undefined) user.email = data.email?.trim()?.toLowerCase() || undefined;
        await user.save();
      }
    }

    await AuditService.log({
      actorId,
      action: 'CUSTOMER_DETAILS_UPDATED',
      targetResource: 'retailers',
      targetId: retailerId,
      details: {
        updatedFields: Object.keys(data),
        businessName: retailer.businessName,
        contactPerson: retailer.contactPerson,
        phone: retailer.phone,
        email: retailer.email,
        gstin: retailer.gstin,
      },
      ipAddress: ip,
      userAgent,
    });

    return retailer;
  }

  /**
   * Safe Archival or Deletion of Customer.
   * If customer has existing orders, invoices, or ledger history,
   * performs safe archival (isArchived: true, isActive: false, user suspended)
   * to strictly preserve financial and audit records.
   * If no orders or invoices exist, performs permanent deletion.
   */
  static async deleteOrArchiveCustomer(
    retailerId: string,
    actorId: string,
    reason?: string,
    ip?: string,
    userAgent?: string
  ): Promise<{ action: 'archived' | 'deleted'; message: string; customerId: string }> {
    if (!mongoose.Types.ObjectId.isValid(retailerId)) {
      throw AppError.badRequest('Invalid customer ID format');
    }

    const retailer = await Retailer.findById(retailerId);
    if (!retailer) {
      throw AppError.notFound('Customer profile not found');
    }

    // Check if retailer has historical orders or financial balances
    const orderCount = await Order.countDocuments({ retailerId: retailer._id });
    const hasFinancialActivity =
      orderCount > 0 ||
      (retailer.outstandingReceivablesPaise || 0) > 0 ||
      (retailer.activeReservationsPaise || 0) > 0;

    if (hasFinancialActivity) {
      // SAFE ARCHIVAL: Preserve historical orders, invoices, and ledger integrity
      retailer.isArchived = true;
      retailer.archivedAt = new Date();
      retailer.archivedBy = actorId as any;
      retailer.isActive = false;
      await retailer.save();

      if (retailer.userId) {
        const user = await User.findById(retailer.userId);
        if (user) {
          user.accountStatus = AccountStatus.SUSPENDED;
          user.currentRefreshSessionId = undefined;
          await user.save();
        }
      }

      await AuditService.log({
        actorId,
        action: 'CUSTOMER_ARCHIVED',
        targetResource: 'retailers',
        targetId: retailerId,
        details: {
          businessName: retailer.businessName,
          orderCount,
          reason: reason || 'Customer account archived to preserve historical audit records',
        },
        ipAddress: ip,
        userAgent,
      });

      return {
        action: 'archived',
        message: `Customer account "${retailer.businessName}" has ${orderCount} existing order(s) and was safely archived to preserve financial records.`,
        customerId: retailer._id.toString(),
      };
    } else {
      // PERMANENT DELETION: Safe to remove since no historical orders or financial records exist
      const userId = retailer.userId;
      await Retailer.findByIdAndDelete(retailerId);
      if (userId) {
        await User.findByIdAndDelete(userId);
      }

      await AuditService.log({
        actorId,
        action: 'CUSTOMER_DELETED',
        targetResource: 'retailers',
        targetId: retailerId,
        details: {
          businessName: retailer.businessName,
          reason: reason || 'Customer deleted (no order or financial history)',
        },
        ipAddress: ip,
        userAgent,
      });

      return {
        action: 'deleted',
        message: `Customer account "${retailer.businessName}" deleted successfully.`,
        customerId: retailerId,
      };
    }
  }

  static async updateMyAddresses(
    retailerId: string,
    data: {
      billingAddress?: Partial<IRetailerDocument['billingAddress']>;
      deliveryAddresses?: Array<IRetailerDocument['deliveryAddresses'][number]>;
    }
  ) {
    const retailer = await Retailer.findById(retailerId);
    if (!retailer) {
      throw AppError.notFound('Retailer profile not found');
    }

    if (data.billingAddress) {
      if (!data.billingAddress.street || !data.billingAddress.city || !data.billingAddress.state || !data.billingAddress.pincode) {
        throw AppError.badRequest('Incomplete billing address: street, city, state, and pincode are required');
      }
      retailer.billingAddress = {
        street: data.billingAddress.street.trim(),
        city: data.billingAddress.city.trim(),
        state: data.billingAddress.state.trim(),
        pincode: data.billingAddress.pincode.trim(),
        stateCode: data.billingAddress.stateCode ? data.billingAddress.stateCode.trim() : (retailer.billingAddress?.stateCode || '03'),
      };
    }

    if (Array.isArray(data.deliveryAddresses)) {
      for (const addr of data.deliveryAddresses) {
        if (!addr.street || !addr.city || !addr.state || !addr.pincode) {
          throw AppError.badRequest('Each delivery address must have street, city, state, and pincode');
        }
      }
      retailer.deliveryAddresses = data.deliveryAddresses.map((addr) => ({
        street: addr.street.trim(),
        city: addr.city.trim(),
        state: addr.state.trim(),
        pincode: addr.pincode.trim(),
        stateCode: addr.stateCode ? addr.stateCode.trim() : '03',
        isDefault: Boolean(addr.isDefault),
      })) as any;
    }

    await retailer.save();
    return {
      billingAddress: retailer.billingAddress,
      deliveryAddresses: retailer.deliveryAddresses,
    };
  }
}
