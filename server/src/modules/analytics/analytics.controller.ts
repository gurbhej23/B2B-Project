import { Request, Response, NextFunction } from 'express';
import { analyticsService } from './analytics.service';
import { sendSuccess } from '../../utils/response';

export class AnalyticsController {
  async getOverviewMetrics(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await analyticsService.getOverviewMetrics(req.query as any);
      sendSuccess(res, result, 'Analytics and reporting metrics loaded successfully');
    } catch (err) {
      next(err);
    }
  }

  async exportCsvReport(req: Request, res: Response, next: NextFunction) {
    try {
      const type = (req.query.type as any) || 'sales';
      const csvString = await analyticsService.exportCsvReport(type, req.query as any);

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="Necessity-India-${type}-report-${Date.now()}.csv"`
      );
      res.send(csvString);
    } catch (err) {
      next(err);
    }
  }
}

export const analyticsController = new AnalyticsController();

