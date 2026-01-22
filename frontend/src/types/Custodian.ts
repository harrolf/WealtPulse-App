export interface Custodian {
    id: number;
    name: string;
    type: string;
    dividend_default?: string;
    website_url?: string;
    notes?: string;
    user_id: number;
}
