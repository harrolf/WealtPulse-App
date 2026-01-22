import api from './api';
import type { User } from './auth';

export interface UserShare {
    id: number;
    owner_id: number;
    viewer_id: number;
    permission: 'read' | 'full';
    created_at: string;
}

export const UserService = {
    listUsers: async (skip = 0, limit = 100): Promise<User[]> => {
        const response = await api.get<User[]>('/users', { params: { skip, limit } });
        return response.data;
    },

    getAccessibleUsers: async (): Promise<User[]> => {
        const response = await api.get<User[]>('/users/me/access');
        return response.data;
    },

    resetPassword: async (userId: number, password: string): Promise<void> => {
        await api.post(`/users/${userId}/password`, { password });
    },

    updateUser: async (userId: number, data: { is_active?: boolean; is_admin?: boolean }): Promise<User> => {
        const response = await api.patch<User>(`/users/${userId}`, data);
        return response.data;
    },

    sharePortfolio: async (userId: number, permission: 'read' | 'full' = 'full'): Promise<UserShare> => {
        const response = await api.post<UserShare>(`/users/${userId}/share`, { permission });
        return response.data;
    },

    revokeShare: async (userId: number): Promise<void> => {
        await api.delete(`/users/${userId}/share`);
    },

    deleteUser: async (userId: number): Promise<void> => {
        await api.delete(`/users/${userId}`);
    }
};
