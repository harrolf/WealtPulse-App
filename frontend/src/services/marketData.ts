import api from './api';

export interface ExchangeRate {
    currency: string;
    rate: number;
    timestamp: string;
}

export const MarketDataService = {
    getCurrencies: async () => {
        // Assuming this endpoint returns the list of available/supported currencies
        // Often this might just be part of the settings or metadata
        const response = await api.get<string[]>('/market/currencies');
        return response.data;
    },

    getRates: async () => {
        const response = await api.get<ExchangeRate[]>('/market/rates');
        return response.data;
    }
};
