import api from './api';

export interface Transaction {
    id: number;
    asset_id: number;
    type: string;
    date: string;
    quantity_change: number;
    price_per_unit: number;
    fees: number;
    notes?: string;
    dest_custodian_id?: number;
    created_at: string;
}

export interface TransactionCreate {
    asset_id: number;
    type: string;
    date: string;
    quantity_change: number;
    price_per_unit: number;
    fees?: number;
    notes?: string;
    dest_custodian_id?: number;
}

export const TransactionsService = {
    // Usually fetching transactions for a specific asset
    getByAsset: async (assetId: number) => {
        const response = await api.get<Transaction[]>(`/assets/${assetId}/transactions`);
        return response.data;
    },

    // Potentially fetching all transactions if endpoint exists
    getAll: async (skip = 0, limit = 100) => {
        const response = await api.get<Transaction[]>(`/transactions?skip=${skip}&limit=${limit}`);
        return response.data;
    },

    create: async (data: TransactionCreate) => {
        const response = await api.post<Transaction>('/transactions', data);
        return response.data;
    },

    delete: async (id: number) => {
        const response = await api.delete(`/transactions/${id}`);
        return response.data;
    }
};
