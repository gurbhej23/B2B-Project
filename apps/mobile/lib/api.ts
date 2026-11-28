import { Platform } from 'react-native';
import { SecureSession } from './secure-store';

declare const process: any;

const DEFAULT_LAN_API = 'http://192.168.31.21:5000/api/v1';

let currentBaseUrl: string = (() => {
  try {
    if (typeof process !== 'undefined') {
      if (process?.env?.EXPO_PUBLIC_API_URL) return process.env.EXPO_PUBLIC_API_URL;
      if (process?.env?.API_URL) return process.env.API_URL;
    }
  } catch {
    // ignore env access error
  }
  return DEFAULT_LAN_API;
})();

export const getBaseUrl = (): string => currentBaseUrl;

export const setBaseUrl = (url: string): void => {
  currentBaseUrl = url;
};

export const API_BASE_URL = currentBaseUrl;

export function getMediaUrl(url?: string): string {
  if (!url) return '';
  if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('data:')) {
    return url;
  }
  const host = getBaseUrl().replace(/\/api\/v1\/?$/, '');
  const cleanPath = url.startsWith('/') ? url : `/${url}`;
  return `${host}${cleanPath}`;
}

import { ApiError, extractErrorMessage } from '@necessity/shared';

export { ApiError, extractErrorMessage };

export interface ApiResponse<T = any> {
  success: boolean;
  message?: string;
  data: T;
  code?: string;
}

type SessionEventHandler = (reason: string) => void;
const customerDisabledListeners = new Set<SessionEventHandler>();
const sessionExpiredListeners = new Set<SessionEventHandler>();

export function onCustomerDisabled(handler: SessionEventHandler): () => void {
  customerDisabledListeners.add(handler);
  return () => customerDisabledListeners.delete(handler);
}

export function onSessionExpired(handler: SessionEventHandler): () => void {
  sessionExpiredListeners.add(handler);
  return () => sessionExpiredListeners.delete(handler);
}

export function triggerCustomerDisabled(
  reason = 'Your account has been disabled. Please contact the administrator.'
): void {
  customerDisabledListeners.forEach((fn) => {
    try {
      fn(reason);
    } catch (e) {
      if (__DEV__) console.warn('Error in customerDisabled listener:', e);
    }
  });
}

export function triggerSessionExpired(
  reason = 'Your session has expired. Please sign in again.'
): void {
  sessionExpiredListeners.forEach((fn) => {
    try {
      fn(reason);
    } catch (e) {
      if (__DEV__) console.warn('Error in sessionExpired listener:', e);
    }
  });
}

export async function clearLocalAuthSession(): Promise<void> {
  await Promise.all([
    SecureSession.removeItem('necessity_access_token'),
    SecureSession.removeItem('necessity_refresh_token'),
    SecureSession.removeItem('necessity_user'),
    SecureSession.removeItem('necessity_retailer'),
  ]);
}

export async function request<T = any>(
  endpoint: string,
  options: RequestInit = {}
): Promise<ApiResponse<T>> {
  const url = endpoint.startsWith('http') ? endpoint : `${getBaseUrl()}${endpoint}`;
  const accessToken = await SecureSession.getItem('necessity_access_token');

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (accessToken) {
    headers['Authorization'] = `Bearer ${accessToken}`;
  }

  let response: Response;
  try {
    response = await fetch(url, {
      ...options,
      headers,
    });
  } catch (err: any) {
    // Automatic fallback for USB debugging via adb reverse tcp:5000 tcp:5000
    if (url.includes('192.168.31.21:5000')) {
      const fallbackUsbUrl = url.replace('192.168.31.21:5000', 'localhost:5000');
      try {
        response = await fetch(fallbackUsbUrl, {
          ...options,
          headers,
        });
        setBaseUrl('http://localhost:5000/api/v1');
      } catch {
        throw new ApiError(
          `Network connection failed. Cannot connect to ${url}. Ensure mobile device is on the same Wi-Fi network (192.168.31.21:5000) or connected via USB.`,
          0,
          'NETWORK_ERROR'
        );
      }
    } else {
      throw new ApiError(
        `Network connection failed. Cannot connect to ${url}. Ensure mobile device is on the same Wi-Fi network or connected via USB.`,
        0,
        'NETWORK_ERROR'
      );
    }
  }

  // Handle Token Expiry & Automatic Refresh (for 401 on protected routes)
  if (response.status === 401 && !endpoint.includes('/auth/login') && !endpoint.includes('/auth/refresh')) {
    const refreshToken = await SecureSession.getItem('necessity_refresh_token');
    if (refreshToken) {
      try {
        const refreshRes = await fetch(`${getBaseUrl()}/auth/refresh`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refreshToken }),
        });

        if (refreshRes.ok) {
          const refreshData = await refreshRes.json();
          const newAccessToken = refreshData.data?.accessToken || refreshData.data?.tokens?.accessToken;
          const newRefreshToken = refreshData.data?.refreshToken || refreshData.data?.tokens?.refreshToken;

          if (newAccessToken) {
            await SecureSession.setItem('necessity_access_token', newAccessToken);
            if (newRefreshToken) {
              await SecureSession.setItem('necessity_refresh_token', newRefreshToken);
            }

            headers['Authorization'] = `Bearer ${newAccessToken}`;
            response = await fetch(url, {
              ...options,
              headers,
            });
          }
        } else {
          // Token renewal failed, wipe session and trigger expiration
          await clearLocalAuthSession();
          triggerSessionExpired();
          throw new ApiError('Session expired. Please sign in again.', 401, 'TOKEN_EXPIRED');
        }
      } catch (refreshErr) {
        if (refreshErr instanceof ApiError) {
          throw refreshErr;
        }
        await clearLocalAuthSession();
        triggerSessionExpired();
        throw new ApiError('Session expired. Please sign in again.', 401, 'TOKEN_EXPIRED');
      }
    } else {
      await clearLocalAuthSession();
      triggerSessionExpired();
      throw new ApiError('Authentication token missing or expired.', 401, 'UNAUTHORIZED');
    }
  }

  // Safely parse JSON or text response
  let json: any = null;
  const responseText = await response.text();
  try {
    json = responseText ? JSON.parse(responseText) : {};
  } catch {
    json = { message: responseText || `Request failed with status ${response.status}` };
  }

  if (!response.ok) {
    const code: string | undefined =
      json.code ||
      json.error?.code ||
      (response.status === 401 ? 'UNAUTHORIZED' : response.status === 403 ? 'FORBIDDEN' : undefined);

    let extractedMessage: string =
      (typeof json.message === 'string' && json.message.trim() && json.message !== '[object Object]' ? json.message.trim() : '') ||
      (typeof json.error?.message === 'string' && json.error.message.trim() && json.error.message !== '[object Object]' ? json.error.message.trim() : '') ||
      (typeof json.error === 'string' && json.error.trim() && json.error !== '[object Object]' ? json.error.trim() : '') ||
      `Request failed with status ${response.status}`;

    const isCustomerDisabled =
      code === 'CUSTOMER_DISABLED' ||
      code === 'ACCOUNT_SUSPENDED' ||
      (response.status === 403 && extractedMessage.toLowerCase().includes('disabled'));

    if (isCustomerDisabled) {
      // Securely clear stored customer auth tokens and cached data
      await clearLocalAuthSession();

      // Trigger centralized session revocation event
      triggerCustomerDisabled('Your account has been disabled. Please contact the administrator.');

      throw new ApiError(
        'Your account has been disabled. Please contact the administrator.',
        response.status,
        'CUSTOMER_DISABLED',
        json.error?.details || json.details,
        json
      );
    }

    throw new ApiError(
      extractedMessage,
      response.status,
      code,
      json.error?.details || json.details,
      json
    );
  }

  return json;
}

export const mobileApi = {
  get: <T = any>(endpoint: string) => request<T>(endpoint, { method: 'GET' }),
  post: <T = any>(endpoint: string, body?: any) =>
    request<T>(endpoint, { method: 'POST', body: body ? JSON.stringify(body) : undefined }),
  patch: <T = any>(endpoint: string, body?: any) =>
    request<T>(endpoint, { method: 'PATCH', body: body ? JSON.stringify(body) : undefined }),
  delete: <T = any>(endpoint: string) => request<T>(endpoint, { method: 'DELETE' }),
};
