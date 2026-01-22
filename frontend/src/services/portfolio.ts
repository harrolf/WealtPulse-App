import api from './api';


export interface AssetSummaryItem {
    id: number;
    name: string;
    asset_type: string;
    category: string;
    quantity: number;
    value: number;
    currency: string;
    asset_currency: string;
    custodian?: string;
    primary_group?: string;
    tags?: string[];
}

export interface PortfolioSummaryResponse {
    total_assets: number;
    total_value: number;
    main_currency: string;
    currencies: Record<string, number>;
    is_historical: boolean;
    date: string;
    assets?: AssetSummaryItem[];
}

export interface AllocationItem {
    name: string;
    value: number;
}

export interface AllocationResponse {
    by_category: AllocationItem[];
    by_asset_type: AllocationItem[];
    by_currency: AllocationItem[];
    by_custodian: AllocationItem[];
    by_group: AllocationItem[];
    by_tag: AllocationItem[];
}

export const PortfolioService = {
    getSummary: async (date?: string) => {
        const params = date ? { date } : {};
        const response = await api.get<PortfolioSummaryResponse>('/portfolio/summary', { params });
        return response.data;
    },

    getAllocation: async (date?: string) => {
        const params = date ? { date } : {};
        const response = await api.get<AllocationResponse>('/portfolio/allocation', { params });
        return response.data;
    },

    getHistory: async (period?: string) => {
        const params = period ? { period } : {};
        const response = await api.get('/portfolio/history', { params });
        return response.data;
    }
};
