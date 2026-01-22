import axios, { AxiosError, type InternalAxiosRequestConfig } from 'axios';
import { AuthService } from './auth';
import { actionLog } from './actionLog';

interface CustomInternalAxiosRequestConfig extends InternalAxiosRequestConfig {
    _retry?: boolean;
}

interface ApiErrorData {
    detail?: string;
}

// Create axios instance with base URL
const api = axios.create({
    baseURL: import.meta.env.VITE_API_URL || '/api/v1',
    headers: {
        'Content-Type': 'application/json',
    },
});

// Context switching
const PORTFOLIO_USER_KEY = 'portfolio_user_id';

export const setPortfolioUser = (userId: number | null) => {
    if (userId) {
        localStorage.setItem(PORTFOLIO_USER_KEY, userId.toString());
    } else {
        localStorage.removeItem(PORTFOLIO_USER_KEY);
    }
    // Force reload to refresh all queries with new context?
    // Or just let query invalidation handle it. Reload is safer for simple implementation.
    window.location.reload();
};

export const getPortfolioUser = (): number | null => {
    const stored = localStorage.getItem(PORTFOLIO_USER_KEY);
    return stored ? parseInt(stored) : null;
};

// Request interceptor to add auth token and context header
api.interceptors.request.use(
    (config) => {
        const token = AuthService.getAccessToken();
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }

        const portfolioUserId = getPortfolioUser();
        if (portfolioUserId) {
            config.headers['X-Portfolio-User-ID'] = portfolioUserId.toString();
        }

        // Add CSRF Token
        const getCookie = (name: string) => {
            const value = `; ${document.cookie}`;
            const parts = value.split(`; ${name}=`);
            if (parts.length === 2) return parts.pop()?.split(';').shift();
        };
        const csrfToken = getCookie('wp_csrftoken');
        if (csrfToken) {
            config.headers['X-CSRFToken'] = csrfToken;
        }

        return config;
    },
    (error) => Promise.reject(error)
);

// Response interceptor for error handling
let isRefreshing = false;
let failedQueue: { resolve: (token: string | null) => void; reject: (err: unknown) => void }[] = [];

const processQueue = (error: unknown, token: string | null = null) => {
    failedQueue.forEach((prom) => {
        if (error) {
            prom.reject(error);
        } else {
            prom.resolve(token);
        }
    });

    failedQueue = [];
};

api.interceptors.response.use(
    (response) => response,
    async (error: AxiosError<ApiErrorData>) => {
        const originalRequest = error.config as CustomInternalAxiosRequestConfig;

        // Handle 401 Unauthorized
        if (error.response?.status === 401 && originalRequest && !originalRequest._retry) {
            // CRITICAL: If the failed request IS the refresh token request, do not retry.
            // Just reject it so the catch block below handles the logout.
            if (originalRequest.url?.includes('/auth/refresh')) {
                return Promise.reject(error);
            }

            if (isRefreshing) {
                return new Promise(function (resolve, reject) {
                    failedQueue.push({ resolve, reject });
                })
                    .then((token) => {
                        if (originalRequest.headers) {
                            originalRequest.headers['Authorization'] = 'Bearer ' + token;
                        }
                        return api(originalRequest);
                    })
                    .catch((err) => {
                        return Promise.reject(err);
                    });
            }

            originalRequest._retry = true;
            isRefreshing = true;

            const refreshToken = AuthService.getRefreshToken();

            if (!refreshToken) {
                console.error("No refresh token available - Logging out.");
                AuthService.clearTokens();
                if (window.location.pathname !== '/login') {
                    window.location.href = '/login';
                }
                return Promise.reject(error);
            }

            try {
                // Call refresh endpoint
                const response = await AuthService.refreshToken(refreshToken);

                const newToken = response.access_token;

                api.defaults.headers.common['Authorization'] = 'Bearer ' + newToken;
                if (originalRequest.headers) {
                    originalRequest.headers['Authorization'] = 'Bearer ' + newToken;
                }

                processQueue(null, newToken);

                return api(originalRequest);
            } catch (refreshError) {
                processQueue(refreshError, null);
                console.error("Session refresh failed - Logging out.", refreshError);
                AuthService.clearTokens();
                if (window.location.pathname !== '/login') {
                    window.location.href = '/login';
                }
                return Promise.reject(refreshError);
            } finally {
                isRefreshing = false;
            }
        }

        // Handle specific error status codes here
        const errorMessage = error.response?.data?.detail || error.message || 'Unknown API Error';

        // Only log if not 401 (since we handled it above) or if it's the final failure
        if (error.response?.status !== 401) {
            console.error('API Error:', error.response?.data || error.message);
            actionLog.error(`API Error: ${errorMessage}`, {
                url: error.config?.url,
                method: error.config?.method,
                status: error.response?.status,
                data: error.response?.data
            });
        }

        return Promise.reject(error);
    }
);

export default api;

