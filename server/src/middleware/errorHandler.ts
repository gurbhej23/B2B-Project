import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { AppError } from '../utils/errors';
import { sendError } from '../utils/response';
import { ERROR_CODES, HTTP_STATUS } from '../constants';
import { logger } from '../config/logger';
import { ENV } from '../config/env';

export function errorHandler(
  err: any,
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  // If headers are already sent, delegate to Express default handler
  if (res.headersSent) {
    return;
  }

  // 1. Handled AppError instances
  if (err instanceof AppError) {
    sendError(
      res,
      err.statusCode,
      err.code,
      err.message,
      err.details,
      ENV.NODE_ENV === 'development' ? err.stack : undefined
    );
    return;
  }

  // 2. Zod Validation Errors
  if (err instanceof ZodError) {
    const formattedErrors = err.errors.map((e) => ({
      field: e.path.join('.'),
      message: e.message,
    }));
    sendError(
      res,
      HTTP_STATUS.UNPROCESSABLE_ENTITY,
      ERROR_CODES.VALIDATION_ERROR,
      'Validation failed for one or more fields',
      formattedErrors
    );
    return;
  }

  // 2b. JSON Body Parser Syntax Errors
  if (err instanceof SyntaxError && 'body' in err) {
    sendError(
      res,
      HTTP_STATUS.BAD_REQUEST,
      ERROR_CODES.VALIDATION_ERROR,
      'Invalid JSON payload format provided.'
    );
    return;
  }

  // 3. Mongoose Duplicate Key Error (E11000)
  if (err.name === 'MongoServerError' && err.code === 11000) {
    const fields = Object.keys(err.keyValue || {});
    const fieldName = fields[0] || 'resource';
    sendError(
      res,
      HTTP_STATUS.CONFLICT,
      ERROR_CODES.CONFLICT,
      `A record with this ${fieldName} already exists.`
    );
    return;
  }

  // 4. JWT Errors
  if (err.name === 'JsonWebTokenError') {
    sendError(
      res,
      HTTP_STATUS.UNAUTHORIZED,
      ERROR_CODES.INVALID_TOKEN,
      'Invalid authentication token provided.'
    );
    return;
  }

  if (err.name === 'TokenExpiredError') {
    sendError(
      res,
      HTTP_STATUS.UNAUTHORIZED,
      ERROR_CODES.TOKEN_EXPIRED,
      'Authentication token has expired. Please refresh your session.'
    );
    return;
  }

  // 5. Unhandled / Internal Server Errors
  logger.error(
    {
      requestId: req.id,
      errorName: err.name,
      errorMessage: err.message,
      stack: err.stack,
      url: req.originalUrl,
      method: req.method,
    },
    `Unhandled Internal Server Error: ${err.message}`
  );

  sendError(
    res,
    HTTP_STATUS.INTERNAL_SERVER_ERROR,
    ERROR_CODES.INTERNAL_ERROR,
    ENV.NODE_ENV === 'production'
      ? 'An unexpected internal error occurred on the server.'
      : err.message || 'Internal Server Error',
    undefined,
    ENV.NODE_ENV === 'development' ? err.stack : undefined
  );
}
