import api from './api';

export interface Custodian {
    id: number;
    name: string;
    type: string;
    dividend_default?: string;
    website_url?: string;
    notes?: string;
    user_id: number;
}

export interface CustodianCreate {
    name: string;
    type: string;
    dividend_default?: string;
    website_url?: string;
    notes?: string;
}

export interface CustodianUpdate {
    name?: string;
    type?: string;
    dividend_default?: string;
    website_url?: string;
    notes?: string;
}

export const CustodiansService = {
    getAll: async () => {
        const response = await api.get<Custodian[]>('/custodians');
        return response.data;
    },

    create: async (data: CustodianCreate) => {
        const response = await api.post<Custodian>('/custodians', data);
        return response.data;
    },

    update: async (id: number, data: CustodianUpdate) => {
        const response = await api.put<Custodian>(`/custodians/${id}`, data);
        return response.data;
    },

    delete: async (id: number) => {
        const response = await api.delete(`/custodians/${id}`);
        return response.data;
    }
};
