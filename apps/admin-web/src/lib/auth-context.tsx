import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { api } from './api';
import { UserRole, AccountStatus } from '@necessity/shared';

export interface UserSession {
  id: string;
  name: string;
  email?: string;
  phone: string;
  role: UserRole;
  accountStatus: AccountStatus;
  retailerProfileId?: string;
  assignedTerritoryIds?: string[];
}

export interface RetailerSession {
  id: string;
  businessName: string;
  tradeName?: string;
  gstin?: string;
  pan?: string;
  creditLimitPaise: number;
  outstandingReceivablesPaise: number;
  activeReservationsPaise: number;
  availableCreditPaise: number;
  creditStatus: string;
  paymentTermsDays: number;
  billingAddress?: {
    street: string;
    city: string;
    state: string;
    pincode: string;
    stateCode: string;
  };
  deliveryAddresses?: Array<{
    street: string;
    city: string;
    state: string;
    pincode: string;
    stateCode: string;
    isDefault?: boolean;
  }>;
}

interface AuthContextType {
  user: UserSession | null;
  retailer: RetailerSession | null;
  isLoading: boolean;
  login: (identifier: string, password: string, rememberMe?: boolean) => Promise<any>;
  register: (data: any) => Promise<any>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserSession | null>(null);
  const [retailer, setRetailer] = useState<RetailerSession | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchSession = async () => {
    try {
      const res = await api.get('/auth/me');
      if (res.data?.success && res.data?.data) {
        setUser(res.data.data.user);
        setRetailer(res.data.data.retailer || null);
      } else {
        setUser(null);
        setRetailer(null);
      }
    } catch {
      setUser(null);
      setRetailer(null);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchSession();
  }, []);

  const login = async (identifier: string, password: string, rememberMe = false) => {
    const res = await api.post('/auth/login', {
      identifier: identifier.trim(),
      password,
      rememberMe,
    });
    if (res.data?.success) {
      const accessToken = res.data.data?.tokens?.accessToken;
      const refreshToken = res.data.data?.tokens?.refreshToken;
      if (accessToken) {
        localStorage.setItem('necessity_token', accessToken);
        api.defaults.headers.common['Authorization'] = `Bearer ${accessToken}`;
      }
      if (refreshToken) {
        localStorage.setItem('necessity_refresh_token', refreshToken);
      }
      setUser(res.data.data.user);
      setRetailer(res.data.data.retailer || null);
      return res.data.data;
    }
    throw new Error(res.data?.message || 'Login failed');
  };

  const register = async (data: any) => {
    const res = await api.post('/auth/register', data);
    return res.data;
  };

  const logout = async () => {
    try {
      await api.post('/auth/logout');
    } finally {
      localStorage.removeItem('necessity_token');
      localStorage.removeItem('necessity_refresh_token');
      delete api.defaults.headers.common['Authorization'];
      setUser(null);
      setRetailer(null);
    }
  };

  const refreshUser = async () => {
    await fetchSession();
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        retailer,
        isLoading,
        login,
        register,
        logout,
        refreshUser,
        refreshProfile: refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
