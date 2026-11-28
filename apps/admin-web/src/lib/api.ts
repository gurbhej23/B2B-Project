import axios from 'axios';

const getNormalizedBaseUrl = (): string => {
  const rawApiUrl = (import.meta.env.VITE_API_URL as string | undefined)?.trim();
  if (!rawApiUrl) return '/api/v1';
  const cleanUrl = rawApiUrl.replace(/\/+$/, '');
  return cleanUrl.endsWith('/api/v1') ? cleanUrl : `${cleanUrl}/api/v1`;
};

export const API_BASE_URL = getNormalizedBaseUrl();

const initialToken = typeof window !== 'undefined' ? localStorage.getItem('necessity_token') : null;

export const api = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
    ...(initialToken ? { Authorization: `Bearer ${initialToken}` } : {}),
  },
});

export const apiClient = api;

// Request interceptor to ensure Bearer token is attached using AxiosHeaders API
api.interceptors.request.use((config) => {
  const token = typeof window !== 'undefined' ? localStorage.getItem('necessity_token') : null;
  if (token) {
    if (config.headers && typeof config.headers.set === 'function') {
      config.headers.set('Authorization', `Bearer ${token}`);
    } else {
      config.headers = config.headers || {};
      (config.headers as any)['Authorization'] = `Bearer ${token}`;
    }
  }
  return config;
});

// Response interceptor for handling session expiration and refreshing
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (
      error.response?.status === 401 &&
      !originalRequest._retry &&
      !originalRequest.url?.includes('/auth/login') &&
      !originalRequest.url?.includes('/auth/register') &&
      !originalRequest.url?.includes('/auth/refresh-token')
    ) {
      originalRequest._retry = true;
      try {
        const storedRefreshToken =
          typeof window !== 'undefined' ? localStorage.getItem('necessity_refresh_token') : null;

        const refreshRes = await api.post('/auth/refresh-token', {
          refreshToken: storedRefreshToken,
        });

        const newToken = refreshRes.data?.data?.accessToken;
        const newRefreshToken = refreshRes.data?.data?.refreshToken;

        if (typeof window !== 'undefined') {
          if (newToken) {
            localStorage.setItem('necessity_token', newToken);
            api.defaults.headers.common['Authorization'] = `Bearer ${newToken}`;
          }
          if (newRefreshToken) {
            localStorage.setItem('necessity_refresh_token', newRefreshToken);
          }
        }

        if (newToken) {
          if (originalRequest.headers && typeof originalRequest.headers.set === 'function') {
            originalRequest.headers.set('Authorization', `Bearer ${newToken}`);
          } else {
            originalRequest.headers = originalRequest.headers || {};
            originalRequest.headers['Authorization'] = `Bearer ${newToken}`;
          }
        }

        return api(originalRequest);
      } catch (refreshError) {
        if (typeof window !== 'undefined') {
          localStorage.removeItem('necessity_token');
          localStorage.removeItem('necessity_refresh_token');
          delete api.defaults.headers.common['Authorization'];
        }
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);
