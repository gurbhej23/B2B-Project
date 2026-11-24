import { Request, Response } from 'express';
import { asyncHandler } from '../../utils/async-handler';
import { dashboardService } from './dashboard.service';

export class DashboardController {
  static getOverview = asyncHandler(async (_req: Request, res: Response) => {
    const data = await dashboardService.getOverview();
    res.status(200).json({
      success: true,
      data,
    });
  });
}
