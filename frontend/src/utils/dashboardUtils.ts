import { Landmark, TrendingUp, Bitcoin, Wallet, Home, Building2, type LucideIcon } from 'lucide-react';

export const getCustodianIcon = (type: string = ''): LucideIcon => {
    switch (type.toLowerCase()) {
        case 'bank': return Landmark;
        case 'broker': return TrendingUp;
        case 'exchange': return Bitcoin; // Or maybe a crypto-specific generic
        case 'self-custody': return Wallet;
        case 'physical': return Home;
        default: return Building2; // Default
    }
};
