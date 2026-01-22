export interface AssetSummaryItem {
    id: number;
    name: string;
    type: string;
    category: string;
    quantity: number;
    value: number;
    currency: string;
    asset_currency: string;
    custodian?: string;
    primary_group?: string;
    tags: string[];
}

export interface PortfolioSummary {
    total_assets: number;
    total_value: number;
    main_currency: string;
    currencies: Record<string, number>;
    is_historical?: boolean;
    date?: string;
    assets?: AssetSummaryItem[];
}

export interface PerformanceItem {
    name: string;
    value: number;
    change_value: number;
    performance_percent: number;
}

export interface PerformanceData {
    performance_percent: number;
    current_value: number;
    end_value: number;
    start_value: number;
    change_value: number;
    period: string;
    start_date: string;
    breakdown?: PerformanceItem[];
}

export interface TWRSeriesPoint {
    date: string;
    value: number;
    portfolio_value: number;
    daily_return: number;
    net_invested_cumulative: number;
}

export interface PerformanceAdvanced {
    twr_series: TWRSeriesPoint[];
    mwr_annualized: number;
    net_invested: number;
    start_value: number;
    end_value: number;
}

export interface AllocationItem {
    name: string;
    value: number;
    percentage: number;
}

export interface PortfolioAllocation {
    by_category: AllocationItem[];
    by_asset_type: AllocationItem[];
    by_currency: AllocationItem[];
    by_custodian: AllocationItem[];
    by_group: AllocationItem[];
    by_tag: AllocationItem[];
}
