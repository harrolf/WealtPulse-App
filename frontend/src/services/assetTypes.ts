import api from './api';

export interface AssetTypeField {
    name: string;
    type: string;
    label?: string;
    required?: boolean;
    options?: string[]; // For select type
    suffix?: string;
}

export interface AssetType {
    id: number;
    name: string;
    category: string; // Deprecated but used for display
    category_id?: number;
    icon?: string;
    fields?: AssetTypeField[];
    display_config?: Record<string, unknown>;
    is_liability: boolean;
    is_default: boolean;
    supports_pricing: boolean;
    user_id?: number;
}

export interface AssetTypeCreate {
    name: string;
    category?: string;
    category_id?: number;
    icon?: string;
    fields?: AssetTypeField[];
    display_config?: Record<string, unknown>;
    is_liability?: boolean;
    is_default?: boolean;
    supports_pricing?: boolean;
}

export interface AssetTypeUpdate {
    name?: string;
    category?: string;
    category_id?: number;
    icon?: string;
    fields?: AssetTypeField[];
    display_config?: Record<string, unknown>;
    is_liability?: boolean;
    is_default?: boolean;
    supports_pricing?: boolean;
}

export const AssetTypesService = {
    getAll: async () => {
        const response = await api.get<AssetType[]>('/asset-types');
        return response.data;
    },

    create: async (data: AssetTypeCreate) => {
        const response = await api.post<AssetType>('/asset-types', data);
        return response.data;
    },

    update: async (id: number, data: AssetTypeUpdate) => {
        const response = await api.put<AssetType>(`/asset-types/${id}`, data);
        return response.data;
    },

    delete: async (id: number) => {
        const response = await api.delete(`/asset-types/${id}`);
        return response.data;
    },

    // Admin Methods
    getSystem: async () => {
        const response = await api.get<AssetType[]>('/admin/asset-types');
        return response.data;
    },

    createSystem: async (data: AssetTypeCreate) => {
        const response = await api.post<AssetType>('/admin/asset-types', data);
        return response.data;
    },

    updateSystem: async (id: number, data: AssetTypeUpdate) => {
        const response = await api.put<AssetType>(`/admin/asset-types/${id}`, data);
        return response.data;
    },

    deleteSystem: async (id: number) => {
        const response = await api.delete(`/admin/asset-types/${id}`);
        return response.data;
    }
};
