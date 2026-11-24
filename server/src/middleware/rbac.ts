import { Request, Response, NextFunction } from 'express';
import { UserRole, AccountStatus } from '@necessity/shared';
import { AppError } from '../utils/errors';

export function requireRole(...allowedRoles: UserRole[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      return next(AppError.unauthorized('User must be authenticated.'));
    }

    if (!allowedRoles.includes(req.user.role)) {
      return next(
        AppError.forbidden(
          `Access denied. Role '${req.user.role}' is not authorized to perform this operation.`
        )
      );
    }

    next();
  };
}

export function requireActiveRetailer(req: Request, _res: Response, next: NextFunction): void {
  if (!req.user) {
    return next(AppError.unauthorized('User must be authenticated.'));
  }

  if (req.user.role !== UserRole.RETAILER) {
    return next(AppError.forbidden('Only retailer accounts can perform this action.'));
  }

  if (req.user.accountStatus === AccountStatus.PENDING) {
    return next(AppError.accountPending());
  }

  if (req.user.accountStatus !== AccountStatus.ACTIVE) {
    return next(AppError.accountSuspended());
  }

  next();
}

export function requireStaff(req: Request, _res: Response, next: NextFunction): void {
  const staffRoles = [
    UserRole.SUPER_ADMIN,
    UserRole.ADMIN,
    UserRole.ACCOUNTS_MANAGER,
    UserRole.SALES_MANAGER,
    UserRole.SALESMAN,
    UserRole.WAREHOUSE_MANAGER,
  ];

  if (!req.user || !staffRoles.includes(req.user.role)) {
    return next(AppError.forbidden('Staff access required.'));
  }

  next();
}
