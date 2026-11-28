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
        await api.post('/auth/refresh-token');
        return api(originalRequest);
      } catch (refreshError) {
        // Refresh token also failed or expired, let the app redirect to /login
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);
