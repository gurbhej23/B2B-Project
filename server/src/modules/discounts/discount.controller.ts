import { Request, Response } from 'express';
import { discountService } from './discount.service';
import { asyncHandler } from '../../utils/async-handler';
import { ApiResponse } from '@necessity/shared';
import { Retailer } from '../retailers/retailer.model';

// =========================================================================
// PRODUCT DISCOUNTS CONTROLLERS
// =========================================================================

export const listProductDiscounts = asyncHandler(async (req: Request, res: Response) => {
  const result = await discountService.listProductDiscounts(req.query);
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

export const getProductDiscountById = asyncHandler(async (req: Request, res: Response) => {
  const discount = await discountService.getProductDiscountById(req.params.id as string);
  const response: ApiResponse = {
    success: true,
    data: discount,
    timestamp: new Date().toISOString(),
  };
  res.status(200).json(response);
});

export const createProductDiscount = asyncHandler(async (req: Request, res: Response) => {
  const actorId = (req as any).user?.id || (req as any).user?._id?.toString() || 'SYSTEM';
  const discount = await discountService.createProductDiscount(req.body, actorId);
  const response: ApiResponse = {
    success: true,
    message: `Product discount '${discount.name}' created successfully`,
    data: discount,
    timestamp: new Date().toISOString(),
  };
  res.status(201).json(response);
});

export const updateProductDiscount = asyncHandler(async (req: Request, res: Response) => {
  const actorId = (req as any).user?.id || (req as any).user?._id?.toString() || 'SYSTEM';
  const discount = await discountService.updateProductDiscount(req.params.id as string, req.body, actorId);
  const response: ApiResponse = {
    success: true,
    message: `Product discount '${discount.name}' updated successfully`,
    data: discount,
    timestamp: new Date().toISOString(),
  };
  res.status(200).json(response);
});

export const toggleProductDiscountStatus = asyncHandler(async (req: Request, res: Response) => {
  const actorId = (req as any).user?.id || (req as any).user?._id?.toString() || 'SYSTEM';
  const { isActive } = req.body;
  const discount = await discountService.toggleProductDiscountStatus(
    req.params.id as string,
    Boolean(isActive),
    actorId
  );
  const response: ApiResponse = {
    success: true,
    message: `Product discount '${discount.name}' ${discount.isActive ? 'activated' : 'deactivated'} successfully`,
    data: discount,
    timestamp: new Date().toISOString(),
  };
  res.status(200).json(response);
});

export const deleteProductDiscount = asyncHandler(async (req: Request, res: Response) => {
  const actorId = (req as any).user?.id || (req as any).user?._id?.toString() || 'SYSTEM';
  const result = await discountService.deleteProductDiscount(req.params.id as string, actorId);
  const response: ApiResponse = {
    success: true,
    message: result.message,
    data: result,
    timestamp: new Date().toISOString(),
  };
  res.status(200).json(response);
});

// =========================================================================
// COUPONS CONTROLLERS
// =========================================================================

export const listCoupons = asyncHandler(async (req: Request, res: Response) => {
  const result = await discountService.listCoupons(req.query);
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

export const getCouponById = asyncHandler(async (req: Request, res: Response) => {
  const coupon = await discountService.getCouponById(req.params.id as string);
  const response: ApiResponse = {
    success: true,
    data: coupon,
    timestamp: new Date().toISOString(),
  };
  res.status(200).json(response);
});

export const createCoupon = asyncHandler(async (req: Request, res: Response) => {
  const actorId = (req as any).user?.id || (req as any).user?._id?.toString() || 'SYSTEM';
  const coupon = await discountService.createCoupon(req.body, actorId);
  const response: ApiResponse = {
    success: true,
    message: `Coupon '${coupon.code}' created successfully`,
    data: coupon,
    timestamp: new Date().toISOString(),
  };
  res.status(201).json(response);
});

export const updateCoupon = asyncHandler(async (req: Request, res: Response) => {
  const actorId = (req as any).user?.id || (req as any).user?._id?.toString() || 'SYSTEM';
  const coupon = await discountService.updateCoupon(req.params.id as string, req.body, actorId);
  const response: ApiResponse = {
    success: true,
    message: `Coupon '${coupon.code}' updated successfully`,
    data: coupon,
    timestamp: new Date().toISOString(),
  };
  res.status(200).json(response);
});

export const toggleCouponStatus = asyncHandler(async (req: Request, res: Response) => {
  const actorId = (req as any).user?.id || (req as any).user?._id?.toString() || 'SYSTEM';
  const { isActive } = req.body;
  const coupon = await discountService.toggleCouponStatus(
    req.params.id as string,
    Boolean(isActive),
    actorId
  );
  const response: ApiResponse = {
    success: true,
    message: `Coupon '${coupon.code}' ${coupon.isActive ? 'activated' : 'deactivated'} successfully`,
    data: coupon,
    timestamp: new Date().toISOString(),
  };
  res.status(200).json(response);
});

export const deleteCoupon = asyncHandler(async (req: Request, res: Response) => {
  const actorId = (req as any).user?.id || (req as any).user?._id?.toString() || 'SYSTEM';
  const result = await discountService.deleteCoupon(req.params.id as string, actorId);
  const response: ApiResponse = {
    success: true,
    message: result.message,
    data: result,
    timestamp: new Date().toISOString(),
  };
  res.status(200).json(response);
});

export const listCouponRedemptions = asyncHandler(async (req: Request, res: Response) => {
  const couponId = req.params.id as string;
  const result = await discountService.listRedemptions(couponId, req.query);
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

export const listAllRedemptions = asyncHandler(async (req: Request, res: Response) => {
  const result = await discountService.listRedemptions(undefined, req.query);
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

// =========================================================================
// CUSTOMER COUPON VALIDATION & PROMOTIONS
// =========================================================================

export const validateCouponCode = asyncHandler(async (req: Request, res: Response) => {
  const { code, taxableAmountPaise } = req.body;
  const currentUser = (req as any).user;

  let retailerId: string | undefined = undefined;
  let customerType: string | undefined = undefined;
  let pricingGroupId: string | undefined = undefined;
  let discountGroupId: string | undefined = undefined;

  if (currentUser?.retailerProfileId) {
    retailerId = currentUser.retailerProfileId.toString();
    const retailer = await Retailer.findById(retailerId).select('customerType pricingGroupId discountGroupId');
    customerType = retailer?.customerType;
    pricingGroupId = retailer?.pricingGroupId?.toString();
    discountGroupId = retailer?.discountGroupId?.toString();
  }

  const result = await discountService.validateCoupon(
    code,
    taxableAmountPaise || 0,
    retailerId,
    customerType,
    pricingGroupId,
    discountGroupId
  );

  const response: ApiResponse = {
    success: true,
    message: `Coupon code '${result.coupon.code}' applied successfully`,
    data: {
      code: result.coupon.code,
      description: result.coupon.description,
      discountType: result.coupon.discountType,
      discountValue: result.coupon.discountValue,
      discountAmountPaise: result.discountAmountPaise,
    },
    timestamp: new Date().toISOString(),
  };
  res.status(200).json(response);
});

// =========================================================================
// DISCOUNT GROUPS HANDLERS
// =========================================================================

export const listDiscountGroups = asyncHandler(async (req: Request, res: Response) => {
  const groups = await discountService.listDiscountGroups(req.query);
  res.status(200).json({ success: true, data: groups });
});

export const getDiscountGroupById = asyncHandler(async (req: Request, res: Response) => {
  const group = await discountService.getDiscountGroupById(req.params.id);
  res.status(200).json({ success: true, data: group });
});

export const createDiscountGroup = asyncHandler(async (req: Request, res: Response) => {
  const group = await discountService.createDiscountGroup(req.body);
  res.status(201).json({ success: true, data: group, message: 'Discount group created successfully' });
});

export const updateDiscountGroup = asyncHandler(async (req: Request, res: Response) => {
  const group = await discountService.updateDiscountGroup(req.params.id, req.body);
  res.status(200).json({ success: true, data: group, message: 'Discount group updated successfully' });
});

export const deleteDiscountGroup = asyncHandler(async (req: Request, res: Response) => {
  const result = await discountService.deleteDiscountGroup(req.params.id);
  res.status(200).json({ success: true, message: result.message });
});
