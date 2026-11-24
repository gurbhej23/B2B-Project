import { ERROR_CODES, HTTP_STATUS } from '../constants';

export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly details?: any;
  public readonly isOperational: boolean;

  constructor(
    message: string,
    statusCode: number = HTTP_STATUS.BAD_REQUEST,
    code: string = ERROR_CODES.VALIDATION_ERROR,
    details?: any
  ) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }

  static badRequest(message: string, code = ERROR_CODES.VALIDATION_ERROR, details?: any) {
    return new AppError(message, HTTP_STATUS.BAD_REQUEST, code, details);
  }

  static unauthorized(message = 'Unauthorized access', code = ERROR_CODES.UNAUTHORIZED) {
    return new AppError(message, HTTP_STATUS.UNAUTHORIZED, code);
  }

  static forbidden(message = 'Forbidden access to this resource', code = ERROR_CODES.FORBIDDEN) {
    return new AppError(message, HTTP_STATUS.FORBIDDEN, code);
  }

  static notFound(message = 'Resource not found', code = ERROR_CODES.NOT_FOUND) {
    return new AppError(message, HTTP_STATUS.NOT_FOUND, code);
  }

  static conflict(message: string, code = ERROR_CODES.CONFLICT) {
    return new AppError(message, HTTP_STATUS.CONFLICT, code);
  }

  static accountLocked(message = 'Account is temporarily locked due to multiple failed login attempts. Please try again later.') {
    return new AppError(message, HTTP_STATUS.FORBIDDEN, ERROR_CODES.ACCOUNT_LOCKED);
  }

  static accountPending(message = 'Your retailer account is pending approval by the distributor administrator.') {
    return new AppError(message, HTTP_STATUS.FORBIDDEN, ERROR_CODES.ACCOUNT_PENDING_APPROVAL);
  }

  static accountSuspended(message = 'This account has been suspended. Please contact customer support.') {
    return new AppError(message, HTTP_STATUS.FORBIDDEN, ERROR_CODES.ACCOUNT_SUSPENDED);
  }

  static customerDisabled(message = 'Your account has been disabled. Please contact the administrator.') {
    return new AppError(message, HTTP_STATUS.FORBIDDEN, ERROR_CODES.CUSTOMER_DISABLED);
  }

  static customerNotApproved(message = 'Your retailer account is pending approval by the distributor administrator.') {
    return new AppError(message, HTTP_STATUS.FORBIDDEN, ERROR_CODES.CUSTOMER_NOT_APPROVED);
  }

  static invalidCredentials(message = 'Invalid phone/email or password') {
    return new AppError(message, HTTP_STATUS.UNAUTHORIZED, ERROR_CODES.INVALID_CREDENTIALS);
  }

  static internal(message = 'An unexpected internal error occurred', details?: any) {
    return new AppError(message, HTTP_STATUS.INTERNAL_SERVER_ERROR, ERROR_CODES.INTERNAL_ERROR, details);
  }
}
