import api from './api';

export interface BrokerImportSummary {
    broker: string;
    total_transactions: number;
    buys: number;
    sells: number;
    dividends: number;
    deposits: number;
    withdrawals: number;
    fees: number;
    other: number;
    unique_assets: number;
    asset_tickers: string[];
    total_deposited: number;
    total_withdrawn: number;
    total_dividends: number;
    total_fees: number;
    date_range: {
        start: string | null;
        end: string | null;
    };
}

export interface BrokerDetectionResponse {
    detected_broker: string;
    confidence: 'high' | 'medium' | 'low';
    supported: boolean;
}

export interface SupportedBroker {
    id: string;
    name: string;
    supported: boolean;
    status: 'active' | 'coming_soon';
}

export interface SupportedBrokersResponse {
    brokers: SupportedBroker[];
    total: number;
    active: number;
}

export const IntegrationsService = {
    /**
     * Get list of supported brokers/exchanges
     */
    async getSupportedBrokers(): Promise<SupportedBrokersResponse> {
        const response = await api.get<SupportedBrokersResponse>('/integrations/supported');
        return response.data;
    },

    /**
     * Detect broker type from file (without full parsing)
     */
    async detectBroker(file: File): Promise<BrokerDetectionResponse> {
        const formData = new FormData();
        formData.append('file', file);

        const response = await api.post<BrokerDetectionResponse>(
            '/integrations/detect',
            formData,
            {
                headers: {
                    'Content-Type': 'multipart/form-data',
                },
            }
        );

        return response.data;
    },

    /**
     * Upload and parse broker/exchange CSV file
     * 
     * @param file - CSV file from broker/exchange
     * @param broker - Optional manual broker selection (overrides auto-detection)
     */
    async uploadFile(file: File, broker?: string, skipClosedPositions: boolean = true, simplifiedImport: boolean = false): Promise<BrokerImportSummary> {
        const formData = new FormData();
        formData.append('file', file);

        const params = new URLSearchParams();
        if (broker) params.append('broker', broker);
        params.append('skip_closed_positions', skipClosedPositions.toString());
        params.append('simplified_import', simplifiedImport.toString());

        const url = `/integrations/upload?${params.toString()}`;

        const response = await api.post<BrokerImportSummary>(
            url,
            formData,
            {
                headers: {
                    'Content-Type': 'multipart/form-data',
                },
            }
        );

        return response.data;
    },

    /**
     * Import transactions directly from file
     */
    async importTransactions(file: File, broker?: string, skipClosedPositions: boolean = true, simplifiedImport: boolean = false): Promise<{
        imported: number;
        skipped: number;
        assets_created: number;
        broker: string;
    }> {
        const formData = new FormData();
        formData.append('file', file);

        const params = new URLSearchParams();
        if (broker) params.append('broker', broker);
        params.append('skip_closed_positions', skipClosedPositions.toString());
        params.append('simplified_import', simplifiedImport.toString());

        const url = `/integrations/import?${params.toString()}`;

        const response = await api.post<{
            imported: number;
            skipped: number;
            assets_created: number;
            broker: string;
        }>(
            url,
            formData,
            {
                headers: {
                    'Content-Type': 'multipart/form-data',
                },
            }
        );

        return response.data;
    },
};
