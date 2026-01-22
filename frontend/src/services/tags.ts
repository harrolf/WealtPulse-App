import api from './api';

export interface Tag {
    id: number;
    name: string;
    color: string;
    description?: string;
    user_id: number;
}

export interface TagCreate {
    name: string;
    color: string;
    description?: string;
}

export interface TagUpdate {
    name?: string;
    color?: string;
    description?: string;
}

export const TagsService = {
    getAll: async () => {
        const response = await api.get<Tag[]>('/tags');
        return response.data;
    },

    create: async (data: TagCreate) => {
        const response = await api.post<Tag>('/tags', data);
        return response.data;
    },

    update: async (id: number, data: TagUpdate) => {
        const response = await api.put<Tag>(`/tags/${id}`, data);
        return response.data;
    },

    delete: async (id: number) => {
        const response = await api.delete(`/tags/${id}`);
        return response.data;
    }
};
