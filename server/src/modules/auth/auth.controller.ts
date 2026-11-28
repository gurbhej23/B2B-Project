import { Request, Response, NextFunction } from 'express';
import { AuthService } from './auth.service';
import { sendSuccess } from '../../utils/response';
import { HTTP_STATUS, AUTH_SETTINGS } from '../../constants';
import { ENV } from '../../config/env';

import { registerRetailerSchema, registerCustomerMobileSchema } from '@necessity/shared';

export class AuthController {
  static async register(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      let validatedBody: any = req.body;
      if (req.body.address || req.body.confirmPassword) {
        validatedBody = registerCustomerMobileSchema.parse(req.body);
      } else {
        validatedBody = registerRetailerSchema.parse(req.body);
      }

      const result = await AuthService.registerRetailer(
        validatedBody,
        req.ip,
        req.headers['user-agent']
      );
      sendSuccess(res, result, result.message, HTTP_STATUS.CREATED);
    } catch (error) {
      next(error);
    }
  }

  static async login(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { identifier, password, rememberMe } = req.body;
      const result = await AuthService.login(
        identifier,
        password,
        req.ip,
        req.headers['user-agent']
      );

      // Set HttpOnly cookies for Web clients
      const isProd = ENV.NODE_ENV === 'production';
      res.cookie(AUTH_SETTINGS.ACCESS_TOKEN_COOKIE_NAME, result.tokens.accessToken, {
        httpOnly: true,
        secure: isProd,
        sameSite: isProd ? 'none' : 'lax',
        maxAge: 15 * 60 * 1000, // 15 mins
      });

      res.cookie(AUTH_SETTINGS.REFRESH_TOKEN_COOKIE_NAME, result.tokens.refreshToken, {
        httpOnly: true,
        secure: isProd,
        sameSite: isProd ? 'none' : 'lax',
        maxAge: rememberMe ? 7 * 24 * 60 * 60 * 1000 : 24 * 60 * 60 * 1000,
      });

      sendSuccess(res, result, 'Login successful');
    } catch (error) {
      next(error);
    }
  }

  static async refreshToken(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const token =
        req.cookies?.[AUTH_SETTINGS.REFRESH_TOKEN_COOKIE_NAME] || req.body?.refreshToken;

      const newTokens = await AuthService.refreshTokens(token);

      const isProd = ENV.NODE_ENV === 'production';
      res.cookie(AUTH_SETTINGS.ACCESS_TOKEN_COOKIE_NAME, newTokens.accessToken, {
        httpOnly: true,
        secure: isProd,
        sameSite: isProd ? 'none' : 'lax',
        maxAge: 15 * 60 * 1000,
      });

      res.cookie(AUTH_SETTINGS.REFRESH_TOKEN_COOKIE_NAME, newTokens.refreshToken, {
        httpOnly: true,
        secure: isProd,
        sameSite: isProd ? 'none' : 'lax',
        maxAge: 7 * 24 * 60 * 60 * 1000,
      });

      sendSuccess(res, newTokens, 'Tokens refreshed successfully');
    } catch (error) {
      next(error);
    }
  }

  static async logout(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (req.user) {
        await AuthService.logout(req.user._id.toString());
      }

      const isProd = ENV.NODE_ENV === 'production';
      res.clearCookie(AUTH_SETTINGS.ACCESS_TOKEN_COOKIE_NAME, {
        httpOnly: true,
        secure: isProd,
        sameSite: isProd ? 'none' : 'lax',
      });
      res.clearCookie(AUTH_SETTINGS.REFRESH_TOKEN_COOKIE_NAME, {
        httpOnly: true,
        secure: isProd,
        sameSite: isProd ? 'none' : 'lax',
      });

      sendSuccess(res, { loggedOut: true }, 'Signed out successfully');
    } catch (error) {
      next(error);
    }
  }

  static async me(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        return next();
      }
      const data = await AuthService.getMe(req.user._id.toString());
      sendSuccess(res, data);
    } catch (error) {
      next(error);
    }
  }

  static async updateProfile(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        return next();
      }
      const { name, email } = req.body;
      const data = await AuthService.updateProfile(req.user._id.toString(), { name, email });
      sendSuccess(res, data, 'Profile updated successfully');
    } catch (error) {
      next(error);
    }
  }

  static async changePassword(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        return next();
      }
      const { currentPassword, newPassword } = req.body;
      if (!currentPassword || !newPassword) {
        res.status(HTTP_STATUS.BAD_REQUEST).json({
          success: false,
          error: { code: 'BAD_REQUEST', message: 'Current password and new password are required' },
        });
        return;
      }
      await AuthService.changePassword(req.user._id.toString(), currentPassword, newPassword);
      sendSuccess(res, { updated: true }, 'Password changed successfully');
    } catch (error) {
      next(error);
    }
  }

  static async checkStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const identifier =
        (req.query.identifier as string) ||
        (req.body?.identifier as string) ||
        (req.query.email as string) ||
        (req.body?.email as string) ||
        (req.query.phone as string) ||
        (req.body?.phone as string);
      const userId = (req as any).user?._id?.toString();
      const result = await AuthService.checkStatus(identifier, userId);
      sendSuccess(res, result, result.message);
    } catch (error) {
      next(error);
    }
  }

  static async createStaff(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await AuthService.createStaffUser(req.body, req.user);
      sendSuccess(res, result, 'Staff account created successfully', HTTP_STATUS.CREATED);
    } catch (error) {
      next(error);
    }
  }
}

