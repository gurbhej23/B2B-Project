import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { mobileApi, clearLocalAuthSession, onCustomerDisabled, onSessionExpired } from '../../lib/api';
import { SecureSession } from '../../lib/secure-store';
import { MobileUser, RetailerProfile } from '../types/models';

interface AuthContextType {
  user: MobileUser | null;
  retailer: RetailerProfile | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  isPendingApproval: boolean;
  isDisabled: boolean;
  disabledReason: string | null;
  customerType: string;
  isRetailer: boolean;
  isWholesaler: boolean;
  isDistributor: boolean;
  pricingGroupId: string | null;
  discountGroupId: string | null;
  login: (identifier: string, password: string) => Promise<void>;
  register: (payload: any) => Promise<any>;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<MobileUser | null>(null);
  const [retailer, setRetailer] = useState<RetailerProfile | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [disabledReason, setDisabledReason] = useState<string | null>(null);

  const refreshProfile = useCallback(async () => {
    try {
      const response = await mobileApi.get('/auth/me');
      if (response.success && response.data) {
        const remoteUser = response.data.user;
        const remoteRetailer = response.data.retailerProfile || response.data.retailer;

        setUser(remoteUser);
        setRetailer(remoteRetailer);

        await SecureSession.setItem('necessity_user', remoteUser);
        if (remoteRetailer) {
          await SecureSession.setItem('necessity_retailer', remoteRetailer);
        }

        if (remoteUser?.accountStatus === 'DISABLED' || remoteUser?.isActive === false) {
          setDisabledReason('Your account has been deactivated by administration.');
        } else {
          setDisabledReason(null);
        }
      }
    } catch (err: any) {
      if (err?.code === 'CUSTOMER_DISABLED') {
        setDisabledReason('Your account has been deactivated by administration.');
      }
      throw err;
    }
  }, []);

  const bootstrapSession = useCallback(async () => {
    setIsLoading(true);
    try {
      const token = await SecureSession.getItem('necessity_access_token');
      if (!token) {
        setUser(null);
        setRetailer(null);
        setIsLoading(false);
        return;
      }

      // Read cached user first for instant UI response
      const cachedUserStr = await SecureSession.getItem('necessity_user');
      const cachedRetailerStr = await SecureSession.getItem('necessity_retailer');
      if (cachedUserStr) {
        try {
          setUser(JSON.parse(cachedUserStr));
        } catch {
          // ignore cache parse error
        }
      }
      if (cachedRetailerStr) {
        try {
          setRetailer(JSON.parse(cachedRetailerStr));
        } catch {
          // ignore cache parse error
        }
      }

      // Verify and sync with server
      await refreshProfile();
    } catch (err: any) {
      // If unauthorized, clean up
      if (err?.status === 401 || err?.code === 'UNAUTHORIZED') {
        await clearLocalAuthSession();
        setUser(null);
        setRetailer(null);
      }
    } finally {
      setIsLoading(false);
    }
  }, [refreshProfile]);

  useEffect(() => {
    bootstrapSession();

    // Listen to real-time events triggered by the API interceptor
    const unsubDisabled = onCustomerDisabled((reason) => {
      setDisabledReason(reason || 'Your account has been disabled.');
      setUser((prev) => (prev ? { ...prev, accountStatus: 'DISABLED', isActive: false } : null));
    });

    const unsubExpired = onSessionExpired(() => {
      setUser(null);
      setRetailer(null);
    });

    return () => {
      unsubDisabled();
      unsubExpired();
    };
  }, [bootstrapSession]);

  const login = async (identifier: string, password: string): Promise<void> => {
    setDisabledReason(null);
    await clearLocalAuthSession();

    const response = await mobileApi.post('/auth/login', {
      identifier: identifier.trim(),
      password,
    });

    const authData = response.data || response;
    const authUser = authData.user;
    const tokens = authData.tokens || {};
    const accessToken = tokens.accessToken || authData.accessToken;
    const refreshToken = tokens.refreshToken || authData.refreshToken;

    if (!accessToken) {
      throw new Error('Authentication succeeded but security tokens were missing.');
    }

    await SecureSession.setItem('necessity_access_token', accessToken);
    if (refreshToken) {
      await SecureSession.setItem('necessity_refresh_token', refreshToken);
    }
    if (authUser) {
      await SecureSession.setItem('necessity_user', authUser);
      setUser(authUser);
    }
    if (authData.retailer) {
      await SecureSession.setItem('necessity_retailer', authData.retailer);
      setRetailer(authData.retailer);
    }

    // Refresh full profile in background
    try {
      await refreshProfile();
    } catch {
      // Ignore background refresh failure
    }
  };

  const register = async (payload: any): Promise<any> => {
    setDisabledReason(null);
    const response = await mobileApi.post('/auth/register', payload);
    return response.data || response;
  };

  const logout = async (): Promise<void> => {
    try {
      await mobileApi.post('/auth/logout');
    } catch {
      // Ignore logout endpoint network error
    } finally {
      await clearLocalAuthSession();
      setUser(null);
      setRetailer(null);
      setDisabledReason(null);
    }
  };

  const isPendingApproval =
    Boolean(user && (user.accountStatus === 'PENDING' || retailer?.accountStatus === 'PENDING'));

  const isDisabled =
    Boolean(
      disabledReason ||
      (user && (user.accountStatus === 'DISABLED' || user.isActive === false)) ||
      (retailer && (retailer.accountStatus === 'DISABLED' || retailer.isActive === false))
    );

  const isAuthenticated = Boolean(user && !isDisabled);

  const rawType = String(retailer?.customerType || '').toLowerCase();
  const isWholesaler = rawType === 'wholesaler' || rawType === 'old';
  const isDistributor = rawType === 'distributor';
  const isRetailer = !isWholesaler && !isDistributor;
  const customerType = isWholesaler ? 'wholesaler' : isDistributor ? 'distributor' : 'retailer';
  const pricingGroupId = (retailer as any)?.pricingGroupId?._id || (retailer as any)?.pricingGroupId || null;
  const discountGroupId = (retailer as any)?.discountGroupId?._id || (retailer as any)?.discountGroupId || null;

  return (
    <AuthContext.Provider
      value={{
        user,
        retailer,
        isLoading,
        isAuthenticated,
        isPendingApproval,
        isDisabled,
        disabledReason,
        customerType,
        isRetailer,
        isWholesaler,
        isDistributor,
        pricingGroupId,
        discountGroupId,
        login,
        register,
        logout,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
