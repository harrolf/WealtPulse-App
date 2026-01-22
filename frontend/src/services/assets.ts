import api from './api';
import type { AssetType } from './assetTypes';
import type { Custodian } from './custodians';
import type { PrimaryGroup } from './groups';
import type { Tag } from './tags';

export interface Asset {
    id: number;
    name: string;
    ticker_symbol?: string;
    purchase_date?: string;
    purchase_price?: number;
    currency: string;
    notes?: string;
    is_favorite: boolean;
    custom_fields?: Record<string, unknown>;

    // Computed/Relations
    current_price?: number;
    quantity: number;
    value_in_main_currency?: number;

    custodian_id: number;
    asset_type_id: number;
    group_id?: number;

    // Expanded objects often returned
    asset_type?: AssetType;
    custodian?: Custodian;
    group?: PrimaryGroup;
    tags?: Tag[];
}

export interface AssetCreate {
    name: string;
    ticker_symbol?: string;
    purchase_date?: string;
    purchase_price?: number;
    currency?: string;
    notes?: string;
    is_favorite?: boolean;
    custom_fields?: Record<string, unknown>;

    quantity?: number;

    custodian_id: number;
    asset_type_id: number;
    group_id?: number;
    tag_ids?: number[];
}

export interface AssetUpdate {
    name?: string;
    ticker_symbol?: string;
    purchase_date?: string;
    purchase_price?: number;
    currency?: string;
    notes?: string;
    is_favorite?: boolean;
    custom_fields?: Record<string, unknown>;

    quantity?: number; // Only for direct updates if allowed, usually via transaction

    custodian_id?: number;
    asset_type_id?: number;
    group_id?: number;
    tag_ids?: number[];
}

export const AssetsService = {
    getAll: async () => {
        const response = await api.get<Asset[]>('/assets');
        return response.data;
    },

    getOne: async (id: number) => {
        const response = await api.get<Asset>(`/assets/${id}`);
        return response.data;
    },

    create: async (data: AssetCreate) => {
        const response = await api.post<Asset>('/assets', data);
        return response.data;
    },

    update: async (id: number, data: AssetUpdate) => {
        const response = await api.put<Asset>(`/assets/${id}`, data);
        return response.data;
    },

    delete: async (id: number) => {
        const response = await api.delete(`/assets/${id}`);
        return response.data;
    },

    revalue: async (id: number, price: number) => {
        const response = await api.post<Asset>(`/assets/${id}/revalue`, { price });
        return response.data;
    }
};
