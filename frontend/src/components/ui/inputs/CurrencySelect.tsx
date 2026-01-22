
import React from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '@/services/api';
import { cn } from '@/lib/utils';
import { ChevronDown } from 'lucide-react';

interface CurrencySelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
    label?: string;
    exclude?: string[];
}

export function CurrencySelect({ className, exclude = [], ...props }: CurrencySelectProps) {
    const { data: settings } = useQuery({
        queryKey: ['user-settings'],
        queryFn: async () => {
            const response = await api.get('/settings');
            return response.data;
        },
        staleTime: 5 * 60 * 1000, // 5 minutes
    });

    const defaultCurrencies = ['USD', 'EUR', 'CHF', 'GBP', 'CAD', 'BTC', 'ETH'];
    const availableCurrencies = settings?.currencies?.length > 0
        ? settings.currencies
        : defaultCurrencies;

    // Filter out excluded currencies if any
    const currencies = availableCurrencies.filter((c: string) => !exclude.includes(c));

    // Ensure props.value is in the list? No, let the parent control value.

    return (
        <div className="relative">
            <select
                className={cn(
                    "w-full appearance-none bg-background border border-border rounded-lg px-4 py-2 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all cursor-pointer",
                    className
                )}
                {...props}
            >
                {currencies.map((c: string) => (
                    <option key={c} value={c}>{c}</option>
                ))}
            </select>
            <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none text-muted-foreground">
                <ChevronDown className="h-4 w-4" />
            </div>
        </div>
    );
}
