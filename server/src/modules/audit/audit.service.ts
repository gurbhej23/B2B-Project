import { AuditLog } from './audit.model';
import { logger } from '../../config/logger';

export interface LogAuditParams {
  actorId?: string;
  action: string;
  targetResource: string;
  targetId?: string;
  details?: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
}

export class AuditService {
  static async log(params: LogAuditParams): Promise<void> {
    try {
      await AuditLog.create(params);
    } catch (error: any) {
      // Never let an audit logging error crash a business transaction, but log it prominently
      logger.error(`Failed to record audit log: ${error.message}`);
    }
  }
}

export const auditLogger = {
  logAction: (params: LogAuditParams) => AuditService.log(params),
};

