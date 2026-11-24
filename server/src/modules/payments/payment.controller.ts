import { Request, Response, NextFunction } from 'express';
import { paymentService } from './payment.service';
import { sendSuccess } from '../../utils/response';

export class PaymentController {
  static async createIntent(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { orderId } = req.body;
      const idempotencyKey = req.headers['idempotency-key'] as string;
      const result = await paymentService.createPaymentOrder(orderId, req.user, idempotencyKey);
      sendSuccess(res, result, 'Payment intent created successfully');
    } catch (err) {
      next(err);
    }
  }

  static async verify(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { providerOrderId, providerPaymentId, signature } = req.body;
      const result = await paymentService.verifyPaymentSignature({
        providerOrderId,
        providerPaymentId,
        signature,
      });
      sendSuccess(res, result, 'Payment signature verified successfully');
    } catch (err) {
      next(err);
    }
  }

  static async recordBankTransfer(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { orderId, utr } = req.body;
      const result = await paymentService.recordBankTransfer(orderId, utr, req.user);
      sendSuccess(res, result, 'Bank transfer reference logged for verification');
    } catch (err) {
      next(err);
    }
  }

  static async webhook(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const signature = req.headers['x-razorpay-signature'] as string;
      const rawBody = JSON.stringify(req.body);
      const result = await paymentService.handleWebhook(rawBody, signature);
      sendSuccess(res, result);
    } catch (err) {
      next(err);
    }
  }

  static async getPending(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await paymentService.getPendingPayments();
      sendSuccess(res, result, 'Pending payments fetched successfully');
    } catch (err) {
      next(err);
    }
  }

  static async verifyPayment(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const { notes } = req.body;
      const result = await paymentService.verifyPayment(id, req.user, notes);
      sendSuccess(res, result, 'Payment verified successfully');
    } catch (err) {
      next(err);
    }
  }

  static async rejectPayment(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;
      const { reason } = req.body;
      const result = await paymentService.rejectPayment(id, req.user, reason);
      sendSuccess(res, result, 'Payment rejected');
    } catch (err) {
      next(err);
    }
  }
}
