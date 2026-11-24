import { Request, Response, NextFunction } from 'express';
import { TokenService, JwtTokenPayload } from '../modules/auth/token.service';
import { User, IUserDocument } from '../modules/users/user.model';
import { AppError } from '../utils/errors';
import { AUTH_SETTINGS } from '../constants';
import { AccountStatus, UserRole } from '@necessity/shared';
import { Retailer } from '../modules/retailers/retailer.model';

declare global {
  namespace Express {
    interface Request {
      user?: IUserDocument;
      tokenPayload?: JwtTokenPayload;
    }
  }
}

export async function authenticate(req: Request, _res: Response, next: NextFunction): Promise<void> {
  try {
    let token: string | undefined;

    // 1. Check HttpOnly cookie first (Web)
    if (req.cookies && req.cookies[AUTH_SETTINGS.ACCESS_TOKEN_COOKIE_NAME]) {
      token = req.cookies[AUTH_SETTINGS.ACCESS_TOKEN_COOKIE_NAME];
    }
    // 2. Check Authorization header (Bearer token for Mobile / API clients)
    else if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
      throw AppError.unauthorized('Authentication token missing. Please sign in.');
    }

    // 3. Verify Token
    const payload = TokenService.verifyAccessToken(token);

    // 4. Fetch User from database
    const user = await User.findById(payload.sub);
    if (!user) {
      throw AppError.unauthorized('User account no longer exists.');
    }

    // 5. Check if account is suspended / disabled
    if (user.accountStatus === AccountStatus.SUSPENDED) {
      throw AppError.customerDisabled('Your account has been disabled. Please contact the administrator.');
    }

    // 6. Check if session has been revoked
    if (user.currentRefreshSessionId && user.currentRefreshSessionId !== payload.sessionId) {
      throw AppError.unauthorized('Session has been revoked or signed out from another device.');
    }

    // 7. Check if retailer account is disabled or unapproved
    if (user.role === UserRole.RETAILER) {
      if (user.accountStatus === AccountStatus.REJECTED) {
        throw AppError.customerNotApproved('Your retailer registration request has been rejected. Please contact administrator.');
      }

      if (user.retailerProfileId) {
        const retailer = await Retailer.findById(user.retailerProfileId).select('isActive');
        if (retailer && user.accountStatus !== AccountStatus.PENDING && retailer.isActive === false) {
          throw AppError.customerDisabled('Your account has been disabled. Please contact the administrator.');
        }
      }

      // If retailer account is PENDING approval:
      // Allow reading profile, browsing product catalog, categories, and brands.
      // Disallow placing orders, modifying cart, and checking out.
      if (user.accountStatus === AccountStatus.PENDING) {
        const isAllowedReadOnly =
          req.method === 'GET' &&
          (req.path === '/me' ||
            req.originalUrl?.includes('/auth/me') ||
            req.originalUrl?.includes('/products') ||
            req.originalUrl?.includes('/categories') ||
            req.originalUrl?.includes('/brands'));

        if (!isAllowedReadOnly) {
          throw AppError.customerNotApproved(
            'Your retailer account is pending approval by the administrator. Ordering and cart are disabled until verified.'
          );
        }
      }
    }

    req.user = user;
    req.tokenPayload = payload;
    next();
  } catch (error) {
    next(error);
  }
}
