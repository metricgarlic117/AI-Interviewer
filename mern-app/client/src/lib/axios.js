import axios from 'axios';
import { getAccessToken, setAccessToken, clearAccessToken } from './authToken';

/**
 * Configured axios instance:
 *  - attaches the in-memory access token to every request
 *  - on a 401, transparently runs the refresh-token flow once (single-flight
 *    across concurrent requests) and retries the original request
 */
export const api = axios.create({
  baseURL: '/api/v1',
  withCredentials: true, // refresh cookie rides along to /auth routes
});

api.interceptors.request.use((config) => {
  const token = getAccessToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

let onSessionExpired = null;
/** Registered by the auth store so an unrecoverable 401 logs the UI out. */
export function setOnSessionExpired(callback) {
  onSessionExpired = callback;
}

let refreshPromise = null;
/**
 * Exchanges the httpOnly refresh cookie for a new access token. Shared
 * promise so ten simultaneous 401s trigger exactly one refresh call.
 */
export function refreshSession() {
  if (!refreshPromise) {
    refreshPromise = axios
      .post('/api/v1/auth/refresh', null, { withCredentials: true })
      .then((res) => {
        const { accessToken, user } = res.data.data;
        setAccessToken(accessToken);
        return { accessToken, user };
      })
      .finally(() => {
        refreshPromise = null;
      });
  }
  return refreshPromise;
}

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config;
    const status = error.response?.status;
    const isAuthEndpoint = original?.url?.startsWith('/auth/');

    if (status === 401 && original && !original._retry && !isAuthEndpoint) {
      original._retry = true;
      try {
        await refreshSession();
        return api(original);
      } catch (refreshError) {
        clearAccessToken();
        onSessionExpired?.();
        return Promise.reject(refreshError);
      }
    }
    return Promise.reject(error);
  }
);

/** Extracts the API error envelope's message for display. */
export function getApiErrorMessage(error, fallback = 'Something went wrong') {
  return error?.response?.data?.message || error?.message || fallback;
}
