import api from './api';

export interface PrimaryGroup {
    id: number;
    name: string;
    color: string;
    icon?: string;
    description?: string;
    user_id: number;
}

export interface PrimaryGroupCreate {
    name: string;
    color: string;
    icon?: string;
    description?: string;
}

export interface PrimaryGroupUpdate {
    name?: string;
    color?: string;
    icon?: string;
    description?: string;
}

export const GroupsService = {
    getAll: async () => {
        const response = await api.get<PrimaryGroup[]>('/groups');
        return response.data;
    },

    create: async (data: PrimaryGroupCreate) => {
        const response = await api.post<PrimaryGroup>('/groups', data);
        return response.data;
    },

    update: async (id: number, data: PrimaryGroupUpdate) => {
        const response = await api.put<PrimaryGroup>(`/groups/${id}`, data);
        return response.data;
    },

    delete: async (id: number) => {
        const response = await api.delete(`/groups/${id}`);
        return response.data;
    }
};
