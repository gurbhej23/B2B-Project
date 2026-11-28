import { Order, IOrderDocument, IOrderNotification } from './order.model';
import { Retailer } from '../retailers/retailer.model';
import { User } from '../users/user.model';
import { EmailService, SendOrderStatusEmailParams } from '../email/email.service';
import { OrderStatus } from '@necessity/shared';
import { logger } from '../../config/logger';
import { ApiError } from '../../utils/api-error';

export class OrderNotificationService {
  /**
   * Returns standard email subject for a given status
   */
  public getSubjectForStatus(status: OrderStatus): string {
    switch (status) {
      case OrderStatus.PENDING:
      case OrderStatus.SUBMITTED:
        return 'Your Order Has Been Placed – Necessity India';
      case OrderStatus.APPROVED:
        return 'Your Order Has Been Approved – Necessity India';
      case OrderStatus.PROCESSING:
        return 'Your Order Is Being Processed – Necessity India';
      case OrderStatus.DISPATCHED:
        return 'Your Order Has Been Dispatched – Necessity India';
      case OrderStatus.PICKED_UP:
        return 'Your Order Has Been Picked Up – Necessity India';
      case OrderStatus.DELIVERED:
        return 'Your Order Has Been Delivered – Necessity India';
      case OrderStatus.REJECTED:
        return 'Order Update: Order Rejected – Necessity India';
      case OrderStatus.CANCELLED:
        return 'Order Update: Order Cancelled – Necessity India';
      default:
        return `Order #${status} Update – Necessity India`;
    }
  }

  /**
   * Resolves recipient email and contact name for an order
   */
  public async resolveCustomerRecipient(order: IOrderDocument): Promise<{
    email: string | null;
    name: string;
    businessName: string;
  }> {
    let email: string | null = null;
    let name = order.placedByName || order.retailerName;
    const businessName = order.retailerName;

    // 1. Check Retailer profile
    if (order.retailerId) {
      const retailer = await Retailer.findById(order.retailerId).select('email contactPerson businessName userId');
      if (retailer) {
        if (retailer.email && retailer.email.trim()) {
          email = retailer.email.trim();
        }
        if (retailer.contactPerson && retailer.contactPerson.trim()) {
          name = retailer.contactPerson.trim();
        }

        // If retailer has no direct email, check linked user
        if (!email && retailer.userId) {
          const linkedUser = await User.findById(retailer.userId).select('email name');
          if (linkedUser?.email) {
            email = linkedUser.email.trim();
            if (!name) name = linkedUser.name;
          }
        }
      }
    }

    // 2. Check placing User
    if (!email && order.placedByUserId) {
      const placingUser = await User.findById(order.placedByUserId).select('email name');
      if (placingUser?.email) {
        email = placingUser.email.trim();
        if (!name) name = placingUser.name;
      }
    }

    return { email, name, businessName };
  }

  /**
   * Dispatches order status notification email and handles duplicate prevention
   */
  public async sendOrderStatusNotification(
    orderId: string,
    targetStatus: OrderStatus,
    customDetails?: any
  ): Promise<IOrderNotification | null> {
    // Only send notifications for supported lifecycle statuses
    const supportedStatuses = [
      OrderStatus.PENDING,
      OrderStatus.SUBMITTED,
      OrderStatus.APPROVED,
      OrderStatus.PROCESSING,
      OrderStatus.DISPATCHED,
      OrderStatus.PICKED_UP,
      OrderStatus.DELIVERED,
      OrderStatus.REJECTED,
    ];

    if (!supportedStatuses.includes(targetStatus)) {
      return null;
    }

    const order = await Order.findById(orderId);
    if (!order) {
      logger.warn(`[OrderNotification] Order ${orderId} not found for notification`);
      return null;
    }

    // 1. DUPLICATE PREVENTION:
    // Check if this status was already successfully notified
    const isPickedUpMatch = (s: OrderStatus) => s === OrderStatus.PICKED_UP || s === OrderStatus.DELIVERED;
    const isPendingMatch = (s: OrderStatus) => s === OrderStatus.PENDING || s === OrderStatus.SUBMITTED;
    const alreadySent = order.notifications?.some((n) => {
      if (!n.success) return false;
      if (n.status === targetStatus) return true;
      if (isPickedUpMatch(targetStatus) && isPickedUpMatch(n.status as OrderStatus)) return true;
      if (isPendingMatch(targetStatus) && isPendingMatch(n.status as OrderStatus)) return true;
      return false;
    });

    if (alreadySent) {
      logger.info(
        `[OrderNotification] Order ${order.orderNumber} already received notification for ${targetStatus}. Duplicate prevented.`
      );
      return null;
    }

    // 2. Resolve recipient email and name
    const { email, name, businessName } = await this.resolveCustomerRecipient(order);
    const subject = this.getSubjectForStatus(targetStatus);

    if (!email || !email.includes('@')) {
      const failedRecord: IOrderNotification = {
        status: targetStatus,
        recipientEmail: email || 'NO_REGISTERED_EMAIL',
        recipientName: name,
        subject,
        success: false,
        attemptedAt: new Date(),
        error: 'Customer has no valid registered email address in Retailer or User profile',
        retryCount: 0,
      };

      try {
        order.notifications = order.notifications || [];
        order.notifications.push(failedRecord);
        await order.save();
      } catch (err: any) {
        logger.warn(
          `[OrderNotification] Could not persist notification record on order ${order.orderNumber}: ${err.message}`
        );
      }

      logger.warn(
        `[OrderNotification] Order ${order.orderNumber} (${targetStatus}) skipped: no registered customer email address.`
      );
      return failedRecord;
    }

    // 3. Prepare parameters for email template
    const totalGst = (order.totalCgstPaise || 0) + (order.totalSgstPaise || 0) + (order.totalIgstPaise || 0);

    const emailParams: SendOrderStatusEmailParams = {
      to: email,
      customerName: name,
      businessName,
      orderNumber: order.orderNumber,
      orderDate: order.createdAt || new Date(),
      status: targetStatus,
      items: order.items.map((it) => ({
        productName: it.productNameSnapshot || 'Product',
        sku: it.skuSnapshot || 'SKU',
        quantity: it.quantity,
        unitPricePaise: it.unitPricePaiseSnapshot,
        lineTotalPaise: it.lineTotalPaise,
      })),
      subtotalPaise: order.subtotalPaise,
      totalGstPaise: totalGst,
      deliveryFeePaise: order.deliveryFeePaise || 0,
      grandTotalPaise: order.grandTotalPaise,
      paymentMethod: order.paymentMethod,
      paymentStatus: order.paymentStatus,
      deliveryAddress: order.deliveryAddress,
      dispatchDetails: customDetails?.dispatchDetails || order.dispatchDetails,
      pickupDetails: customDetails?.pickupDetails || order.pickupDetails,
    };

    // 4. Send email based on target status
    let sendResult;
    try {
      switch (targetStatus) {
        case OrderStatus.PENDING:
        case OrderStatus.SUBMITTED:
          sendResult = await EmailService.sendOrderPlacedEmail(emailParams);
          break;
        case OrderStatus.APPROVED:
          sendResult = await EmailService.sendOrderApprovedEmail(emailParams);
          break;
        case OrderStatus.PROCESSING:
          sendResult = await EmailService.sendOrderProcessingEmail(emailParams);
          break;
        case OrderStatus.DISPATCHED:
          sendResult = await EmailService.sendOrderDispatchedEmail(emailParams);
          break;
        case OrderStatus.PICKED_UP:
          sendResult = await EmailService.sendOrderPickedUpEmail(emailParams);
          break;
        case OrderStatus.DELIVERED:
          sendResult = await EmailService.sendOrderDeliveredEmail(emailParams);
          break;
        case OrderStatus.REJECTED:
          sendResult = await EmailService.sendOrderRejectedEmail(emailParams);
          break;
        default:
          return null;
      }
    } catch (err: any) {
      sendResult = {
        success: false,
        error: err.message || 'Unexpected email delivery error',
      };
    }

    // 5. Atomic notification record logging on the order
    const notificationRecord: IOrderNotification = {
      status: targetStatus,
      recipientEmail: email,
      recipientName: name,
      subject,
      success: sendResult.success,
      sentAt: sendResult.success ? new Date() : undefined,
      attemptedAt: new Date(),
      messageId: sendResult.messageId,
      error: sendResult.error,
      retryCount: 0,
    };

    try {
      order.notifications = order.notifications || [];
      order.notifications.push(notificationRecord);
      await order.save();
    } catch (saveErr: any) {
      logger.warn(
        `[OrderNotification] Could not persist notification record on order ${order.orderNumber}: ${saveErr.message}`
      );
    }

    logger.info(
      `[OrderNotification] Order ${order.orderNumber} ${targetStatus} notification recorded. Result: ${
        sendResult.success ? 'SUCCESS' : 'FAILED'
      } ${sendResult.error ? `(${sendResult.error})` : ''}`
    );

    return notificationRecord;
  }

  /**
   * Retries a failed email notification for an order
   */
  public async retryOrderNotification(
    orderId: string,
    targetStatus?: OrderStatus,
    currentUser?: any
  ): Promise<IOrderNotification> {
    const order = await Order.findById(orderId);
    if (!order) {
      throw ApiError.notFound('Order not found');
    }

    order.notifications = order.notifications || [];

    // Find the notification to retry
    let targetIndex = -1;
    if (targetStatus) {
      targetIndex = order.notifications.findIndex((n) => n.status === targetStatus);
    } else {
      // Find the latest failed notification
      for (let i = order.notifications.length - 1; i >= 0; i--) {
        if (!order.notifications[i].success) {
          targetIndex = i;
          break;
        }
      }
    }

    if (targetIndex === -1 && !targetStatus) {
      throw ApiError.badRequest('No failed notifications found on this order to retry');
    }

    const existing = targetIndex !== -1 ? order.notifications[targetIndex] : null;
    const statusToRetry = targetStatus || existing?.status || order.status;

    // Strict duplicate check: if already succeeded, do not send again
    if (existing && existing.success) {
      throw ApiError.badRequest(
        `Email notification for status '${statusToRetry}' was already successfully sent on ${existing.sentAt}. Duplicate sending blocked.`
      );
    }

    // Resolve recipient
    const { email, name, businessName } = await this.resolveCustomerRecipient(order);
    if (!email || !email.includes('@')) {
      throw ApiError.badRequest(
        'Cannot retry email: customer has no valid registered email address in their profile'
      );
    }

    const totalGst = (order.totalCgstPaise || 0) + (order.totalSgstPaise || 0) + (order.totalIgstPaise || 0);

    const emailParams: SendOrderStatusEmailParams = {
      to: email,
      customerName: name,
      businessName,
      orderNumber: order.orderNumber,
      orderDate: order.createdAt || new Date(),
      status: statusToRetry,
      items: order.items.map((it) => ({
        productName: it.productNameSnapshot || 'Product',
        sku: it.skuSnapshot || 'SKU',
        quantity: it.quantity,
        unitPricePaise: it.unitPricePaiseSnapshot,
        lineTotalPaise: it.lineTotalPaise,
      })),
      subtotalPaise: order.subtotalPaise,
      totalGstPaise: totalGst,
      deliveryFeePaise: order.deliveryFeePaise || 0,
      grandTotalPaise: order.grandTotalPaise,
      paymentMethod: order.paymentMethod,
      paymentStatus: order.paymentStatus,
      deliveryAddress: order.deliveryAddress,
      dispatchDetails: order.dispatchDetails,
      pickupDetails: order.pickupDetails,
    };

    let sendResult;
    try {
      switch (statusToRetry) {
        case OrderStatus.PENDING:
        case OrderStatus.SUBMITTED:
          sendResult = await EmailService.sendOrderPlacedEmail(emailParams);
          break;
        case OrderStatus.APPROVED:
          sendResult = await EmailService.sendOrderApprovedEmail(emailParams);
          break;
        case OrderStatus.PROCESSING:
          sendResult = await EmailService.sendOrderProcessingEmail(emailParams);
          break;
        case OrderStatus.DISPATCHED:
          sendResult = await EmailService.sendOrderDispatchedEmail(emailParams);
          break;
        case OrderStatus.PICKED_UP:
          sendResult = await EmailService.sendOrderPickedUpEmail(emailParams);
          break;
        case OrderStatus.DELIVERED:
          sendResult = await EmailService.sendOrderDeliveredEmail(emailParams);
          break;
        case OrderStatus.REJECTED:
          sendResult = await EmailService.sendOrderRejectedEmail(emailParams);
          break;
        default:
          throw ApiError.badRequest(`Unsupported status '${statusToRetry}' for email notification`);
      }
    } catch (err: any) {
      sendResult = {
        success: false,
        error: err.message || 'Failed to deliver email on retry',
      };
    }

    const retriedBy = currentUser?.name || currentUser?.email || 'Admin';

    if (existing) {
      existing.success = sendResult.success;
      existing.sentAt = sendResult.success ? new Date() : undefined;
      existing.messageId = sendResult.messageId || existing.messageId;
      existing.error = sendResult.error;
      existing.retryCount = (existing.retryCount || 0) + 1;
      existing.lastRetriedAt = new Date();
      existing.lastRetriedBy = retriedBy;
      existing.recipientEmail = email;
      existing.recipientName = name;
    } else {
      order.notifications.push({
        status: statusToRetry,
        recipientEmail: email,
        recipientName: name,
        subject: this.getSubjectForStatus(statusToRetry),
        success: sendResult.success,
        sentAt: sendResult.success ? new Date() : undefined,
        attemptedAt: new Date(),
        messageId: sendResult.messageId,
        error: sendResult.error,
        retryCount: 1,
        lastRetriedAt: new Date(),
        lastRetriedBy: retriedBy,
      });
    }

    await order.save();

    const resultRecord = existing || order.notifications[order.notifications.length - 1];
    return resultRecord;
  }

  /**
   * Dispatches Payment Received (full or partial) notification email
   */
  public async sendPaymentReceivedNotification(
    orderId: string,
    paymentDetails: {
      amountPaidPaise: number;
      totalPaidPaise: number;
      remainingBalancePaise: number;
      grandTotalPaise: number;
      paymentMethod: string;
      referenceNumber: string;
      isPartial: boolean;
      notes?: string;
    }
  ): Promise<IOrderNotification | null> {
    const order = await Order.findById(orderId);
    if (!order) {
      logger.warn(`[OrderNotification] Order ${orderId} not found for payment notification`);
      return null;
    }

    const { email, name, businessName } = await this.resolveCustomerRecipient(order);
    const subject = `${paymentDetails.isPartial ? 'Partial Payment Received' : 'Payment Received in Full'} for Order #${order.orderNumber} – Necessity India`;

    if (!email || !email.includes('@')) {
      logger.warn(`[OrderNotification] Order ${order.orderNumber} payment skipped: no valid registered customer email.`);
      return null;
    }

    let sendResult;
    try {
      sendResult = await EmailService.sendPaymentReceivedEmail({
        to: email,
        customerName: name,
        businessName,
        orderNumber: order.orderNumber,
        orderDate: order.createdAt || new Date(),
        amountPaidPaise: paymentDetails.amountPaidPaise,
        totalPaidPaise: paymentDetails.totalPaidPaise,
        remainingBalancePaise: paymentDetails.remainingBalancePaise,
        grandTotalPaise: paymentDetails.grandTotalPaise,
        paymentMethod: paymentDetails.paymentMethod,
        referenceNumber: paymentDetails.referenceNumber,
        isPartial: paymentDetails.isPartial,
        notes: paymentDetails.notes,
      });
    } catch (err: any) {
      sendResult = {
        success: false,
        error: err.message || 'Unexpected payment email delivery error',
      };
    }

    const notificationRecord: IOrderNotification = {
      status: (paymentDetails.isPartial ? 'PAYMENT_PARTIAL' : 'PAYMENT_RECEIVED') as any,
      recipientEmail: email,
      recipientName: name,
      subject,
      success: sendResult.success,
      sentAt: sendResult.success ? new Date() : undefined,
      attemptedAt: new Date(),
      messageId: sendResult.messageId,
      error: sendResult.error,
      retryCount: 0,
    };

    try {
      order.notifications = order.notifications || [];
      order.notifications.push(notificationRecord);
      await order.save();
    } catch (saveErr: any) {
      logger.warn(`[OrderNotification] Could not persist notification record on order ${order.orderNumber}: ${saveErr.message}`);
    }

    return notificationRecord;
  }

  /**
   * Dispatches Payment Failed / Unsuccessful notification email
   */
  public async sendPaymentFailedNotification(
    orderId: string,
    failureDetails: {
      amountPaise: number;
      paymentMethod: string;
      referenceNumber?: string;
      reason?: string;
    }
  ): Promise<IOrderNotification | null> {
    const order = await Order.findById(orderId);
    if (!order) {
      logger.warn(`[OrderNotification] Order ${orderId} not found for payment failure notification`);
      return null;
    }

    const { email, name, businessName } = await this.resolveCustomerRecipient(order);
    const subject = `Payment Unsuccessful for Order #${order.orderNumber} – Necessity India`;

    if (!email || !email.includes('@')) {
      logger.warn(`[OrderNotification] Order ${order.orderNumber} payment failure skipped: no valid registered customer email.`);
      return null;
    }

    let sendResult;
    try {
      sendResult = await EmailService.sendPaymentFailedEmail({
        to: email,
        customerName: name,
        businessName,
        orderNumber: order.orderNumber,
        orderDate: order.createdAt || new Date(),
        amountPaise: failureDetails.amountPaise,
        paymentMethod: failureDetails.paymentMethod,
        referenceNumber: failureDetails.referenceNumber,
        reason: failureDetails.reason,
      });
    } catch (err: any) {
      sendResult = {
        success: false,
        error: err.message || 'Unexpected payment failure email delivery error',
      };
    }

    const notificationRecord: IOrderNotification = {
      status: 'PAYMENT_FAILED' as any,
      recipientEmail: email,
      recipientName: name,
      subject,
      success: sendResult.success,
      sentAt: sendResult.success ? new Date() : undefined,
      attemptedAt: new Date(),
      messageId: sendResult.messageId,
      error: sendResult.error,
      retryCount: 0,
    };

    try {
      order.notifications = order.notifications || [];
      order.notifications.push(notificationRecord);
      await order.save();
    } catch (saveErr: any) {
      logger.warn(`[OrderNotification] Could not persist payment failure notification record on order ${order.orderNumber}: ${saveErr.message}`);
    }

    return notificationRecord;
  }

  /**
   * Dispatches Payment Refunded notification email
   */
  public async sendPaymentRefundedNotification(
    orderId: string,
    refundDetails: {
      amountRefundedPaise: number;
      paymentMethod: string;
      refundId: string;
      reason?: string;
    }
  ): Promise<IOrderNotification | null> {
    const order = await Order.findById(orderId);
    if (!order) {
      logger.warn(`[OrderNotification] Order ${orderId} not found for payment refund notification`);
      return null;
    }

    const { email, name, businessName } = await this.resolveCustomerRecipient(order);
    const subject = `Payment Refund Initiated for Order #${order.orderNumber} – Necessity India`;

    if (!email || !email.includes('@')) {
      logger.warn(`[OrderNotification] Order ${order.orderNumber} payment refund skipped: no valid registered customer email.`);
      return null;
    }

    let sendResult;
    try {
      sendResult = await EmailService.sendPaymentRefundedEmail({
        to: email,
        customerName: name,
        businessName,
        orderNumber: order.orderNumber,
        amountRefundedPaise: refundDetails.amountRefundedPaise,
        paymentMethod: refundDetails.paymentMethod,
        refundId: refundDetails.refundId,
        reason: refundDetails.reason,
      });
    } catch (err: any) {
      sendResult = {
        success: false,
        error: err.message || 'Unexpected payment refund email delivery error',
      };
    }

    const notificationRecord: IOrderNotification = {
      status: 'PAYMENT_REFUNDED' as any,
      recipientEmail: email,
      recipientName: name,
      subject,
      success: sendResult.success,
      sentAt: sendResult.success ? new Date() : undefined,
      attemptedAt: new Date(),
      messageId: sendResult.messageId,
      error: sendResult.error,
      retryCount: 0,
    };

    try {
      order.notifications = order.notifications || [];
      order.notifications.push(notificationRecord);
      await order.save();
    } catch (saveErr: any) {
      logger.warn(`[OrderNotification] Could not persist refund notification record on order ${order.orderNumber}: ${saveErr.message}`);
    }

    return notificationRecord;
  }
}

export const orderNotificationService = new OrderNotificationService();

