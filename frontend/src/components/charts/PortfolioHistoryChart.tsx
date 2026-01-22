
import { useQuery } from '@tanstack/react-query';
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis, Brush } from 'recharts';
import { formatCurrency } from '@/lib/utils';
import { useSettingsContext } from '@/contexts/SettingsContext';
import api from '@/services/api';
import { useFormattedDateTime } from '@/utils/datetime';
import { useEffect } from 'react';

import type { Settings } from '@/types/settings';

interface PortfolioHistoryChartProps {
    startDate?: string;
    endDate?: string;
    currency?: string;
}

// Custom Tooltip Component
interface CustomTooltipProps {
    active?: boolean;
    payload?: { value: number }[];
    label?: string;
    settings: Settings;
    activeCurrency: string;
    formatDate: (date: string) => string;
    formatTime: (date: string) => string;
}

const CustomTooltip = ({ active, payload, label, settings, activeCurrency, formatDate, formatTime }: CustomTooltipProps) => {
    if (active && payload && payload.length) {
        const date = new Date(Number(label));
        const dateStr = date.toISOString();
        const hasTime = date.getHours() !== 0 || date.getMinutes() !== 0;

        return (
            <div className="glass-strong p-3 rounded-lg border border-border">
                <p className="text-muted-foreground text-xs mb-1">
                    {formatDate(dateStr)}
                    {hasTime && ` ${formatTime(dateStr)}`}
                </p>
                <p className="font-bold text-primary">
                    {formatCurrency(payload[0].value as number, activeCurrency, 2, settings.number_format)}
                </p>
            </div>
        );
    }
    return null;
};


export function PortfolioHistoryChart({ startDate, endDate, currency = 'CHF', timeRange }: PortfolioHistoryChartProps & { timeRange?: string }) {
    const { settings } = useSettingsContext();
    const { formatDate, formatTime } = useFormattedDateTime();
    const { data: historyResponse } = useQuery({
        queryKey: ['portfolio-history', startDate, endDate, timeRange],
        queryFn: async () => {
            const params = { start_date: startDate, end_date: endDate, time_range: timeRange };
            const response = await api.get('/portfolio/history', { params });
            return response.data;
        },
    });

    const historyItems = historyResponse?.history || [];
    const activeCurrency = historyResponse?.main_currency || currency;

    const sortedHistory = [...historyItems].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    // reset index state when timeRange changes
    useEffect(() => {
        // Optional: reset zoom logic if needed when range switches
    }, [timeRange]);

    if (sortedHistory.length === 0) return null;



    // Map data to include numeric timestamp for linear scaling
    const chartData = sortedHistory.map(item => ({
        ...item,
        timestamp: new Date(item.date).getTime()
    }));

    return (
        <div className="w-full h-[350px]">
            <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 10, right: 0, left: 0, bottom: 0 }}>
                    <defs>
                        <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="var(--primary)" stopOpacity={0.3} />
                            <stop offset="95%" stopColor="var(--primary)" stopOpacity={0} />
                        </linearGradient>
                    </defs>
                    <XAxis
                        dataKey="timestamp"
                        type="number"
                        domain={['dataMin', 'dataMax']}
                        hide={true}
                    />
                    <YAxis
                        hide={true}
                        domain={['auto', 'auto']}
                    />
                    <Tooltip content={<CustomTooltip settings={settings} activeCurrency={activeCurrency} formatDate={formatDate} formatTime={formatTime} />} />
                    <Area
                        type="monotone"
                        dataKey="value"
                        stroke="var(--primary)"
                        strokeWidth={2}
                        fillOpacity={1}
                        fill="url(#colorValue)"
                        connectNulls
                        animationDuration={300}
                    />
                    <Brush
                        dataKey="timestamp"
                        height={30}
                        stroke="var(--primary)"
                        tickFormatter={(unixTime) => formatDate(new Date(unixTime).toISOString())}
                        fill="rgba(255, 255, 255, 0.05)"
                        travellerWidth={10}
                    />
                </AreaChart>
            </ResponsiveContainer>
        </div>
    );
}
