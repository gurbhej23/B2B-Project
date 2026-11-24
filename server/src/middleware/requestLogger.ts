import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../config/logger';

declare global {
  namespace Express {
    interface Request {
      id?: string;
    }
  }
}

export function requestLogger(req: Request, res: Response, next: NextFunction): void {
  const reqId = (req.headers['x-request-id'] as string) || uuidv4();
  req.id = reqId;
  res.setHeader('X-Request-Id', reqId);

  const start = Date.now();
  const { method, originalUrl, ip } = req;

  res.on('finish', () => {
    const duration = Date.now() - start;
    const { statusCode } = res;

    const logPayload = {
      requestId: reqId,
      method,
      url: originalUrl,
      status: statusCode,
      durationMs: duration,
      ip,
    };

    if (statusCode >= 500) {
      logger.error(logPayload, `HTTP ${method} ${originalUrl} -> ${statusCode} in ${duration}ms`);
    } else if (statusCode >= 400) {
      logger.warn(logPayload, `HTTP ${method} ${originalUrl} -> ${statusCode} in ${duration}ms`);
    } else {
      logger.info(logPayload, `HTTP ${method} ${originalUrl} -> ${statusCode} in ${duration}ms`);
    }
  });

  next();
}
