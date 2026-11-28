import axios from 'axios';

const getNormalizedBaseUrl = (): string => {
  const rawApiUrl = (import.meta.env.VITE_API_URL as string | undefined)?.trim();
  if (!rawApiUrl) return '/api/v1';
  const cleanUrl = rawApiUrl.replace(/\/+$/, '');
  return cleanUrl.endsWith('/api/v1') ? cleanUrl : `${cleanUrl}/api/v1`;
};

export const API_BASE_URL = getNormalizedBaseUrl();

export const api = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

export const apiClient = api;

// Request interceptor to attach Bearer token (vital for cross-origin hosting e.g. Vercel -> Render)
api.interceptors.request.use((config) => {
  const token = typeof window !== 'undefined' ? localStorage.getItem('necessity_token') : null;
  if (token && !config.headers.Authorization) {
    config.headers.Authorization = `Bearer ${token}`;
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
        const refreshRes = await api.post('/auth/refresh-token');
        const newToken = refreshRes.data?.data?.accessToken;
        if (newToken && typeof window !== 'undefined') {
          localStorage.setItem('necessity_token', newToken);
          originalRequest.headers = originalRequest.headers || {};
          originalRequest.headers.Authorization = `Bearer ${newToken}`;
        }
        return api(originalRequest);
      } catch (refreshError) {
        if (typeof window !== 'undefined') {
          localStorage.removeItem('necessity_token');
        }
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);
