import { Request, Response, NextFunction } from 'express';
import { RetailerService } from './retailer.service';
import { sendSuccess, sendPaginated } from '../../utils/response';
import { AccountStatus, CustomerType } from '@necessity/shared';
import { AppError } from '../../utils/errors';

export class RetailerController {
  static async getPending(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const page = parseInt(req.query.page as string, 10) || 1;
      const limit = parseInt(req.query.limit as string, 10) || 20;

      const result = await RetailerService.getPendingRetailers(page, limit);
      sendPaginated(res, result.data, {
        page: result.page,
        limit: result.limit,
        total: result.total,
      });
    } catch (error) {
      next(error);
    }
  }

  static async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const page = parseInt(req.query.page as string, 10) || 1;
      const limit = parseInt(req.query.limit as string, 10) || 20;
      const search = req.query.search as string;
      const status = req.query.status as any;
      const customerType = req.query.customerType as CustomerType;
      const isActive = req.query.isActive as string;
      const creditStatus = req.query.creditStatus as any;

      const result = await RetailerService.listRetailers(
        {
          page,
          limit,
          search,
          status,
          customerType,
          isActive,
          creditStatus,
        },
        req.user
      );

      sendPaginated(res, result.data, {
        page: result.page,
        limit: result.limit,
        total: result.total,
      });
    } catch (error) {
      next(error);
    }
  }

  static async getById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const retailerId = Array.isArray(req.params.id) ? req.params.id[0] : (req.params.id as string);
      const result = await RetailerService.getRetailerById(retailerId, req.user);
      sendSuccess(res, result);
    } catch (error) {
      next(error);
    }
  }

  static async updateApproval(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const retailerId = Array.isArray(req.params.id) ? req.params.id[0] : (req.params.id as string);
      const approverId = (req.user as any)?._id?.toString() || (req.user as any)?.id?.toString() || '';
      const result = await RetailerService.updateApproval(
        retailerId,
        req.body,
        approverId,
        req.ip,
        req.get('user-agent')
      );
      sendSuccess(res, result, 'Retailer account approval status updated successfully');
    } catch (error) {
      next(error);
    }
  }

  static async approve(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const retailerId = Array.isArray(req.params.id) ? req.params.id[0] : (req.params.id as string);
      const approverId = (req.user as any)?._id?.toString() || (req.user as any)?.id?.toString() || '';
      const result = await RetailerService.updateApproval(
        retailerId,
        {
          status: AccountStatus.ACTIVE,
          customerType: req.body.customerType || CustomerType.RETAILER,
          pricingGroupId: req.body.pricingGroupId,
          discountGroupId: req.body.discountGroupId,
          creditLimitPaise: req.body.creditLimitPaise,
          paymentTermsDays: req.body.paymentTermsDays,
          creditStatus: req.body.creditStatus,
          assignedSalesmanId: req.body.assignedSalesmanId,
        },
        approverId,
        req.ip,
        req.get('user-agent')
      );
      sendSuccess(res, result, 'Customer approved successfully');
    } catch (error) {
      next(error);
    }
  }

  static async reject(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const retailerId = Array.isArray(req.params.id) ? req.params.id[0] : (req.params.id as string);
      const approverId = (req.user as any)?._id?.toString() || (req.user as any)?.id?.toString() || '';
      const result = await RetailerService.updateApproval(
        retailerId,
        {
          status: AccountStatus.REJECTED,
          rejectionReason: req.body.rejectionReason,
        },
        approverId,
        req.ip,
        req.get('user-agent')
      );
      sendSuccess(res, result, 'Customer application rejected');
    } catch (error) {
      next(error);
    }
  }

  static async updateType(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const retailerId = Array.isArray(req.params.id) ? req.params.id[0] : (req.params.id as string);
      const actorId = (req.user as any)?._id?.toString() || (req.user as any)?.id?.toString() || '';
      const { customerType, pricingGroupId, discountGroupId, creditLimitPaise, paymentTermsDays, creditStatus } = req.body;
      const result = await RetailerService.updateCustomerType(
        retailerId,
        customerType,
        actorId,
        req.ip,
        req.get('user-agent'),
        { pricingGroupId, discountGroupId, creditLimitPaise, paymentTermsDays, creditStatus }
      );
      sendSuccess(res, result, `Customer type updated to ${customerType}`);
    } catch (error) {
      next(error);
    }
  }

  static async updateStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const retailerId = Array.isArray(req.params.id) ? req.params.id[0] : (req.params.id as string);
      const actorId = (req.user as any)?._id?.toString() || (req.user as any)?.id?.toString() || '';
      const { isActive, reason } = req.body;
      const result = await RetailerService.updateCustomerStatus(
        retailerId,
        Boolean(isActive),
        actorId,
        reason,
        req.ip,
        req.get('user-agent')
      );
      sendSuccess(
        res,
        result,
        `Customer account ${isActive ? 'enabled' : 'disabled'} successfully`
      );
    } catch (error) {
      next(error);
    }
  }

  static async deleteCustomer(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const retailerId = Array.isArray(req.params.id) ? req.params.id[0] : (req.params.id as string);
      const actorId = (req.user as any)?._id?.toString() || (req.user as any)?.id?.toString() || '';
      const reason = req.body?.reason || req.query?.reason as string;
      const result = await RetailerService.deleteOrArchiveCustomer(
        retailerId,
        actorId,
        reason,
        req.ip,
        req.get('user-agent')
      );
      sendSuccess(res, result, result.message);
    } catch (error) {
      next(error);
    }
  }

  static async updateCustomerDetails(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const retailerId = Array.isArray(req.params.id) ? req.params.id[0] : (req.params.id as string);
      const actorId = (req.user as any)?._id?.toString() || (req.user as any)?.id?.toString() || '';
      const result = await RetailerService.updateCustomerDetails(
        retailerId,
        req.body,
        actorId,
        req.ip,
        req.get('user-agent')
      );
      sendSuccess(res, result, 'Customer details updated successfully');
    } catch (error) {
      next(error);
    }
  }

  static async updateMyAddresses(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = req.user as any;
      const retailerId = user?.retailerProfileId?.toString() || user?.retailerId?.toString();
      if (!retailerId) {
        throw AppError.badRequest('No retailer profile associated with current account');
      }
      const { billingAddress, deliveryAddresses } = req.body;
      const result = await RetailerService.updateMyAddresses(retailerId, {
        billingAddress,
        deliveryAddresses,
      });
      sendSuccess(res, result, 'Addresses updated successfully');
    } catch (error) {
      next(error);
    }
  }
}
