export interface AssetField {
    name: string;
    type: 'text' | 'number' | 'date' | 'select' | 'boolean';
    required?: boolean;
    options?: string[]; // for select
    suffix?: string;
}

export interface AssetType {
    id: number;
    name: string;
    category: string;
    icon?: string;
    fields?: AssetField[];
    is_liability?: boolean;
}
