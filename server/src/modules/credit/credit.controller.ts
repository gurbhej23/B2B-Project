import { Request, Response, NextFunction } from 'express';
import { creditService } from './credit.service';
import { sendSuccess } from '../../utils/response';

export class CreditController {
  async getCreditOverview(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await creditService.getCreditOverview(req.query as any);
      sendSuccess(res, result, 'Credit overview retrieved successfully');
    } catch (err) {
      next(err);
    }
  }

  async getLedger(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await creditService.getLedger(
        req.query as any,
        (req as any).user
      );
      sendSuccess(res, result, 'Customer ledger statement retrieved');
    } catch (err) {
      next(err);
    }
  }

  async recordPayment(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await creditService.recordPayment(
        req.body,
        (req as any).user
      );
      sendSuccess(res, result, 'Payment recorded and ledger updated successfully');
    } catch (err) {
      next(err);
    }
  }

  async recordAdjustment(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await creditService.recordAdjustment(
        req.body,
        (req as any).user
      );
      sendSuccess(res, result, 'Ledger adjustment recorded successfully');
    } catch (err) {
      next(err);
    }
  }

  async updateCreditTerms(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await creditService.updateCreditTerms(
        req.params.retailerId,
        req.body,
        (req as any).user
      );
      sendSuccess(res, result, 'Credit terms updated successfully');
    } catch (err) {
      next(err);
    }
  }
}

export const creditController = new CreditController();
