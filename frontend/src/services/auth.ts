import api from './api';
import { startRegistration } from '@simplewebauthn/browser';
import { jwtDecode } from 'jwt-decode';
import { toast } from '@/services/toast';

export interface User {
    id: number;
    email: string;
    name: string;
    is_active: boolean;
    is_verified: boolean;
    is_admin: boolean;
    created_at: string;
}

export interface AuthResponse {
    access_token: string;
    refresh_token: string;
    token_type: string;
}

const TOKEN_KEY = 'access_token';
const REFRESH_TOKEN_KEY = 'refresh_token';

export const AuthService = {
    // Token Management
    setTokens: (access_token: string, refresh_token: string) => {
        localStorage.setItem(TOKEN_KEY, access_token);
        localStorage.setItem(REFRESH_TOKEN_KEY, refresh_token);
    },

    getAccessToken: (): string | null => {
        return localStorage.getItem(TOKEN_KEY);
    },

    getRefreshToken: (): string | null => {
        return localStorage.getItem(REFRESH_TOKEN_KEY);
    },

    clearTokens: () => {
        localStorage.removeItem(TOKEN_KEY);
        localStorage.removeItem(REFRESH_TOKEN_KEY);
    },

    isAuthenticated: (): boolean => {
        const token = AuthService.getAccessToken();
        if (!token) return false;
        try {
            const decoded = jwtDecode<{ exp: number }>(token);
            return decoded.exp * 1000 > Date.now();
        } catch {
            return false;
        }
    },

    // Auth Actions
    login: async (data: Record<string, string>): Promise<User> => {
        // Explicitly set Content-Type to override global application/json default
        const response = await api.post<AuthResponse>('/auth/login', new URLSearchParams(data), {
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
        });
        AuthService.setTokens(response.data.access_token, response.data.refresh_token);
        return AuthService.getCurrentUser();
    },

    refreshToken: async (refreshToken: string): Promise<AuthResponse> => {
        const response = await api.post<AuthResponse>('/auth/refresh', { refresh_token: refreshToken });
        AuthService.setTokens(response.data.access_token, response.data.refresh_token);
        return response.data;
    },

    register: async (data: unknown): Promise<User> => {
        const response = await api.post<User>('/auth/register', data);
        return response.data;
    },

    logout: async () => {
        AuthService.clearTokens();
        window.location.href = '/login';
    },

    getCurrentUser: async (): Promise<User> => {
        const response = await api.get<User>('/auth/me');
        return response.data;
    },

    // OAuth
    getOAuthUrl: (provider: string): Promise<{ url: string }> => {
        return api.get<{ url: string }>(`/auth/oauth/${provider}`).then(res => res.data);
    },

    handleOAuthCallback: async (provider: string, code: string, state: string): Promise<void> => {
        const response = await api.post<AuthResponse>(`/auth/oauth/${provider}/callback`, { code, state });
        AuthService.setTokens(response.data.access_token, response.data.refresh_token);
    },

    // Passkey
    registerPasskey: async () => {
        // 1. Get options from server
        const optionsResp = await api.post('/auth/passkey/register/options', {
            username: (await AuthService.getCurrentUser()).email
        });

        // 2. Browser interaction
        let attResp;
        try {
            attResp = await startRegistration(optionsResp.data);
        } catch (error) {
            if (error instanceof Error && error.name === 'InvalidStateError') {
                throw new Error('Authenticator was probably already registered by this user');
            }
            throw error;
        }

        // 3. Verify with server
        // Note: Assuming endpoint exists as per plan but stubbed
        // await api.post('/auth/passkey/register/verify', attResp);
        console.log("Passkey registration credential gathered:", attResp);
        toast.info("Passkey registration simulation complete (backend verification pending implementation)");
    },

    // Management
    getConnectedAccounts: async (): Promise<unknown[]> => {
        const response = await api.get('/auth/accounts');
        return response.data;
    },

    unlinkOAuthAccount: async (provider: string): Promise<void> => {
        await api.delete(`/auth/oauth/${provider}`);
    },

    getPasskeys: async (): Promise<unknown[]> => {
        const response = await api.get('/auth/passkeys');
        return response.data;
    },

    deletePasskey: async (id: string): Promise<void> => {
        await api.delete(`/auth/passkeys/${id}`);
    },

    deleteAccount: async () => {
        await api.delete('/users/me');
        AuthService.clearTokens();
    }
};
