import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { UserRole } from '@necessity/shared';
import { ENV } from '../../config/env';

export interface JwtTokenPayload {
  sub: string; // User ID
  role: UserRole;
  sessionId: string;
  retailerProfileId?: string;
  assignedTerritoryIds?: string[];
}

export class TokenService {
  static generateSessionId(): string {
    return uuidv4();
  }

  static generateAccessToken(payload: JwtTokenPayload): string {
    return jwt.sign(payload, ENV.JWT_ACCESS_SECRET, {
      expiresIn: ENV.JWT_ACCESS_EXPIRY as any,
      issuer: 'necessity-b2b',
      audience: 'necessity-clients',
    });
  }

  static generateRefreshToken(payload: JwtTokenPayload): string {
    return jwt.sign(payload, ENV.JWT_REFRESH_SECRET, {
      expiresIn: ENV.JWT_REFRESH_EXPIRY as any,
      issuer: 'necessity-b2b',
      audience: 'necessity-clients',
    });
  }

  static verifyAccessToken(token: string): JwtTokenPayload {
    return jwt.verify(token, ENV.JWT_ACCESS_SECRET, {
      issuer: 'necessity-b2b',
      audience: 'necessity-clients',
    }) as JwtTokenPayload;
  }

  static verifyRefreshToken(token: string): JwtTokenPayload {
    return jwt.verify(token, ENV.JWT_REFRESH_SECRET, {
      issuer: 'necessity-b2b',
      audience: 'necessity-clients',
    }) as JwtTokenPayload;
  }
}
