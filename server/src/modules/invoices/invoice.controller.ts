import { Request, Response, NextFunction } from 'express';
import { invoiceService } from './invoice.service';
import { sendSuccess } from '../../utils/response';

export class InvoiceController {
  async listInvoices(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await invoiceService.listInvoices(
        req.query,
        (req as any).user
      );
      sendSuccess(res, result, 'Invoices list retrieved successfully');
    } catch (err) {
      next(err);
    }
  }

  async getInvoiceById(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await invoiceService.getInvoiceById(
        req.params.id,
        (req as any).user
      );
      sendSuccess(res, result, 'Invoice details retrieved successfully');
    } catch (err) {
      next(err);
    }
  }

  async generateFromOrder(req: Request, res: Response, next: NextFunction) {
    try {
      const asProforma = req.body?.asProforma === true || req.query?.asProforma === 'true';
      const result = await invoiceService.generateFromOrder(
        req.params.orderId,
        (req as any).user,
        { asProforma }
      );
      sendSuccess(
        res,
        result,
        asProforma ? 'Proforma invoice generated successfully' : 'Tax invoice generated successfully'
      );
    } catch (err) {
      next(err);
    }
  }

  async recordPayment(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await invoiceService.recordPayment(
        req.params.id,
        req.body,
        (req as any).user
      );
      sendSuccess(res, result, 'Invoice payment recorded successfully');
    } catch (err) {
      next(err);
    }
  }

  async issueTaxInvoice(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await invoiceService.issueTaxInvoice(
        req.params.id,
        (req as any).user
      );
      sendSuccess(res, result, 'Final tax invoice issued successfully');
    } catch (err) {
      next(err);
    }
  }

  async syncInvoiceToZoho(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await invoiceService.syncInvoiceToZoho(
        req.params.id,
        (req as any).user
      );
      sendSuccess(res, result, 'Invoice synced to Zoho Books successfully');
    } catch (err) {
      next(err);
    }
  }

  async downloadPdf(req: Request, res: Response, next: NextFunction) {
    try {
      const { doc, invoiceNumber } = await invoiceService.generatePdf(
        req.params.id,
        (req as any).user
      );

      const chunks: Buffer[] = [];
      doc.on('data', (chunk: Buffer) => chunks.push(chunk));

      await new Promise<void>((resolve, reject) => {
        doc.on('end', () => resolve());
        doc.on('error', (err: any) => reject(err));
        doc.end();
      });

      const pdfBuffer = Buffer.concat(chunks);

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Length', pdfBuffer.length);
      res.setHeader(
        'Content-Disposition',
        `inline; filename="Tax-Invoice-${invoiceNumber}.pdf"`
      );

      res.status(200).send(pdfBuffer);
    } catch (err) {
      next(err);
    }
  }
}

export const invoiceController = new InvoiceController();
