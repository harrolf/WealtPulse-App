import api from './api';

export interface AssetTypeCategory {
    id: number;
    name: string;
    description?: string;
    is_system: boolean;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    display_config?: Record<string, any>;
}

export interface AssetTypeCategoryCreate {
    name: string;
    description?: string;
    is_system?: boolean;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    display_config?: Record<string, any>;
}

export interface AssetTypeCategoryUpdate {
    name?: string;
    description?: string;
    is_system?: boolean;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    display_config?: Record<string, any>;
}

export const AssetCategoriesService = {
    getAll: async () => {
        const response = await api.get<AssetTypeCategory[]>('/admin/asset-categories');
        return response.data;
    },

    create: async (data: AssetTypeCategoryCreate) => {
        const response = await api.post<AssetTypeCategory>('/admin/asset-categories', data);
        return response.data;
    },

    update: async (id: number, data: AssetTypeCategoryUpdate) => {
        const response = await api.put<AssetTypeCategory>(`/admin/asset-categories/${id}`, data);
        return response.data;
    },

    delete: async (id: number) => {
        const response = await api.delete(`/admin/asset-categories/${id}`);
        return response.data;
    }
};
