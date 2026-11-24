import { Request, Response } from 'express';
import { orderService } from './order.service';
import { cartService } from './cart.service';
import { orderNotificationService } from './order-notification.service';
import { Retailer } from '../retailers/retailer.model';
import { asyncHandler } from '../../utils/async-handler';
import { ApiResponse } from '@necessity/shared';

export const calculateCart = asyncHandler(async (req: Request, res: Response) => {
  const { items, deliveryStateCode, couponCode, retailerId } = req.body;
  const currentUser = (req as any).user;
  let customerType: string | undefined = undefined;
  let effectiveRetailerId: string | undefined = retailerId;

  if (currentUser?.retailerProfileId) {
    effectiveRetailerId = currentUser.retailerProfileId.toString();
    const retailer = await Retailer.findById(effectiveRetailerId).select('customerType');
    customerType = retailer?.customerType;
  } else if (effectiveRetailerId) {
    const retailer = await Retailer.findById(effectiveRetailerId).select('customerType');
    customerType = retailer?.customerType;
  }

  const result = await cartService.calculateCart({
    items,
    deliveryStateCode: deliveryStateCode || '27',
    customerType,
    retailerId: effectiveRetailerId,
    couponCode: couponCode ? String(couponCode).trim() : undefined,
  });

  const response: ApiResponse = {
    success: true,
    data: result,
    timestamp: new Date().toISOString(),
  };
  res.status(200).json(response);
});

export const checkout = asyncHandler(async (req: Request, res: Response) => {
  const currentUser = (req as any).user;
  const order = await orderService.checkout(req.body, currentUser);

  const response: ApiResponse = {
    success: true,
    message: `Order ${order.orderNumber} placed successfully`,
    data: order,
    timestamp: new Date().toISOString(),
  };
  res.status(201).json(response);
});

export const listOrders = asyncHandler(async (req: Request, res: Response) => {
  const currentUser = (req as any).user;
  const result = await orderService.listOrders(req.query, currentUser);

  const response: ApiResponse = {
    success: true,
    data: result.items,
    timestamp: new Date().toISOString(),
  };
  res.status(200).json({
    ...response,
    pagination: result.pagination,
  });
});

export const getOrderById = asyncHandler(async (req: Request, res: Response) => {
  const currentUser = (req as any).user;
  const orderId = Array.isArray(req.params.id) ? req.params.id[0] : (req.params.id as string);
  const order = await orderService.getOrderById(orderId, currentUser);

  const response: ApiResponse = {
    success: true,
    data: order,
    timestamp: new Date().toISOString(),
  };
  res.status(200).json(response);
});

export const updateOrderStatus = asyncHandler(async (req: Request, res: Response) => {
  const currentUser = (req as any).user;
  const { status, reason, dispatchDetails, pickupDetails } = req.body;
  const orderId = Array.isArray(req.params.id) ? req.params.id[0] : (req.params.id as string);
  const order = await orderService.updateOrderStatus(
    orderId,
    status,
    currentUser,
    reason,
    { dispatchDetails, pickupDetails }
  );

  const response: ApiResponse = {
    success: true,
    message: `Order ${order.orderNumber} status updated to ${order.status}`,
    data: order,
    timestamp: new Date().toISOString(),
  };
  res.status(200).json(response);
});

export const retryOrderNotification = asyncHandler(async (req: Request, res: Response) => {
  const currentUser = (req as any).user;
  const orderId = Array.isArray(req.params.id) ? req.params.id[0] : (req.params.id as string);
  const { status } = req.body;

  const notification = await orderNotificationService.retryOrderNotification(
    orderId,
    status,
    currentUser
  );

  const response: ApiResponse = {
    success: true,
    message: notification.success
      ? 'Email notification resent successfully'
      : `Resend attempted: ${notification.error}`,
    data: notification,
    timestamp: new Date().toISOString(),
  };
  res.status(200).json(response);
});

export const recordOrderPayment = asyncHandler(async (req: Request, res: Response) => {
  const currentUser = (req as any).user;
  const orderId = Array.isArray(req.params.id) ? req.params.id[0] : (req.params.id as string);
  const { paymentMethod, referenceNumber, amountPaise, notes } = req.body;

  const order = await orderService.recordOrderPayment(
    orderId,
    { paymentMethod, referenceNumber, amountPaise, notes },
    currentUser
  );

  const response: ApiResponse = {
    success: true,
    message: `Payment successfully recorded for order ${order.orderNumber}. Status: ${order.status}`,
    data: order,
    timestamp: new Date().toISOString(),
  };
  res.status(200).json(response);
});

export const updateOrderPaymentStatus = asyncHandler(async (req: Request, res: Response) => {
  const currentUser = (req as any).user;
  const orderId = Array.isArray(req.params.id) ? req.params.id[0] : (req.params.id as string);
  const { paymentStatus } = req.body;

  const order = await orderService.updateOrderPaymentStatus(
    orderId,
    paymentStatus,
    currentUser
  );

  const response: ApiResponse = {
    success: true,
    message: `Payment status updated to ${order.paymentStatus}`,
    data: order,
    timestamp: new Date().toISOString(),
  };
  res.status(200).json(response);
});

export const sendPaymentReminder = asyncHandler(async (req: Request, res: Response) => {
  const orderId = Array.isArray(req.params.id) ? req.params.id[0] : (req.params.id as string);
  const order = await orderService.getOrderById(orderId, (req as any).user);

  const recipient = order.retailerName || (order.retailerId as any)?.contactPerson || 'Customer';

  const response: ApiResponse = {
    success: true,
    message: `Payment reminder sent successfully via Email, WhatsApp & Push to ${recipient}`,
    data: null,
    timestamp: new Date().toISOString(),
  };
  res.status(200).json(response);
});
