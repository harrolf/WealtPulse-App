import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid, ReferenceLine, Brush } from 'recharts';
import { useQuery } from '@tanstack/react-query';
import api from '@/services/api';
import { cn, formatCurrency } from '@/lib/utils';
import { useSettingsContext } from '@/contexts/SettingsContext';
import { Loader2 } from 'lucide-react';
import { useFormattedDateTime } from '@/utils/datetime';

import type { Settings } from '@/types/settings';

interface HistoryPoint {
    date: string;
    value: number;
}

interface CurrencyHistoryChartProps {
    currency: string;
    mainCurrency: string;
    className?: string;
    timeRange?: string;
}

// Custom Tooltip Component
interface CustomTooltipProps {
    active?: boolean;
    payload?: { value: number }[];
    label?: string;
    settings: Settings;
    mainCurrency: string;
    formatDate: (date: string) => string;
    formatTime: (date: string) => string;
}

const CustomTooltip = ({ active, payload, label, settings, mainCurrency, formatDate, formatTime }: CustomTooltipProps) => {
    if (active && payload && payload.length) {
        const date = new Date(Number(label));
        const dateStr = date.toISOString();
        const hasTime = date.getHours() !== 0 || date.getMinutes() !== 0;
        return (
            <div className="bg-popover/95 border border-border p-3 rounded-xl shadow-xl backdrop-blur-md">
                <p className="text-muted-foreground text-xs mb-1 font-medium">
                    {formatDate(dateStr)}
                    {hasTime && ` ${formatTime(dateStr)}`}
                </p>
                <p className="font-bold text-lg text-foreground tracking-tight">
                    {formatCurrency(payload[0].value as number, mainCurrency, 4, settings.number_format)}
                </p>
            </div>
        );
    }
    return null;
};

export function CurrencyHistoryChart({ currency, mainCurrency, className, timeRange = '1mo' }: CurrencyHistoryChartProps) {
    const { settings } = useSettingsContext();
    let period = timeRange;
    switch (timeRange) {
        case '1w': period = '7d'; break;
        case '1m': period = '1mo'; break;
        case '3m': period = '3mo'; break;
        case 'all': period = 'max'; break;
        case 'ytd': period = 'ytd'; break;
    }

    const { formatDate, formatTime } = useFormattedDateTime();

    const { data: history = [], isLoading } = useQuery<HistoryPoint[]>({
        queryKey: ['currency-history', currency, mainCurrency, period],
        queryFn: async () => {
            const response = await api.get(`/market/history/${currency}`, {
                params: { period: period }
            });
            return response.data;
        },
        staleTime: 1000 * 30,
    });

    if (isLoading) {
        return (
            <div className={cn("flex items-center justify-center h-full text-muted-foreground", className)}>
                <Loader2 className="h-6 w-6 animate-spin" />
            </div>
        );
    }

    if (!history || history.length === 0) {
        return (
            <div className={cn("flex items-center justify-center h-full text-sm text-muted-foreground", className)}>
                No Data Available
            </div>
        );
    }

    const sortedHistory = [...history].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    const first = sortedHistory[0].value;
    const last = sortedHistory[sortedHistory.length - 1].value;
    const isPositive = last >= first;
    // Match colors to reference (Red for down, Green/Cyan for up)
    // Reference image uses a reddish color: #E5545B or similar. Let's use Tailwind equivalents.
    const color = isPositive ? "#22c55e" : "#ef4444";

    const chartData = sortedHistory.map(item => ({
        ...item,
        timestamp: new Date(item.date).getTime()
    }));

    // Find Min/Max for domain with padding
    const minVal = Math.min(...chartData.map(d => d.value));
    const maxVal = Math.max(...chartData.map(d => d.value));
    const padding = (maxVal - minVal) * 0.1;



    return (
        <div className={cn("w-full h-full min-h-[300px] relative", className)}>
            {/* Price Overlay Labels */}
            <div className="absolute top-2 left-2 z-10 bg-background/50 backdrop-blur-sm px-2 py-1 rounded border border-border/50 text-xs font-mono text-muted-foreground pointer-events-none">
                Start: {formatCurrency(first, mainCurrency, 2, settings.number_format)}
            </div>
            <div className="absolute top-2 right-2 z-10 bg-background/50 backdrop-blur-sm px-2 py-1 rounded border border-border/50 text-xs font-mono font-medium text-foreground pointer-events-none">
                End: {formatCurrency(last, mainCurrency, 2, settings.number_format)}
            </div>

            <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 20, right: 0, left: 0, bottom: 0 }}>
                    <defs>
                        <linearGradient id={`gradient-${currency}-${timeRange}`} x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor={color} stopOpacity={0.4} />
                            <stop offset="100%" stopColor={color} stopOpacity={0.0} />
                        </linearGradient>
                    </defs>
                    <CartesianGrid
                        vertical={false}
                        strokeDasharray="3 3"
                        stroke="rgba(255,255,255,0.1)"
                    />
                    <XAxis
                        dataKey="timestamp"
                        type="number"
                        domain={['dataMin', 'dataMax']}
                        tickFormatter={(unixTime) => {
                            // Find the original data point to get the date string
                            const dataPoint = chartData.find(d => d.timestamp === unixTime);
                            if (dataPoint && dataPoint.date) {
                                // For date-only strings (YYYY-MM-DD), format directly
                                // Append T00:00:00Z to ensure it's treated as UTC midnight
                                const isoString = dataPoint.date.includes('T')
                                    ? dataPoint.date
                                    : `${dataPoint.date}T00:00:00Z`;

                                if (period === '1d' || period === '7d' || period === '1w') {
                                    return formatTime(isoString);
                                }
                                return formatDate(isoString);
                            }
                            // Fallback
                            const date = new Date(unixTime);
                            const iso = date.toISOString();
                            if (period === '1d' || period === '7d' || period === '1w') {
                                return formatTime(iso);
                            }
                            return formatDate(iso);
                        }}
                        tick={{ fill: '#6b7280', fontSize: 11 }}
                        tickLine={false}
                        axisLine={false}
                        minTickGap={50}
                    />
                    <YAxis
                        orientation="right"
                        domain={[minVal - padding, maxVal + padding]}
                        tickFormatter={(val) => {
                            if (val >= 1000) return `${(val / 1000).toFixed(1)}K`; // Compact space
                            return val.toFixed(2);
                        }}
                        tick={{ fill: '#6b7280', fontSize: 11 }}
                        tickLine={false}
                        axisLine={false}
                        width={60}
                    />
                    <Tooltip
                        content={<CustomTooltip settings={settings} mainCurrency={mainCurrency} formatDate={formatDate} formatTime={formatTime} />}
                        cursor={{ stroke: 'white', strokeWidth: 1, strokeDasharray: '4 4', opacity: 0.3 }}
                    />

                    <ReferenceLine y={maxVal} stroke="rgba(255,255,255,0.2)" strokeDasharray="3 3" />
                    <ReferenceLine y={minVal} stroke="rgba(255,255,255,0.2)" strokeDasharray="3 3" />

                    <Area
                        type="monotone"
                        dataKey="value"
                        stroke={color}
                        fill={`url(#gradient-${currency}-${timeRange})`}
                        strokeWidth={2}
                        activeDot={{ r: 6, fill: color, stroke: '#1a1a1a', strokeWidth: 2 }}
                        isAnimationActive={false} // Disable animation for snappy feel on range switch
                    />
                    <Brush
                        dataKey="timestamp"
                        height={20}
                        stroke={color}
                        tickFormatter={(unixTime) => {
                            // Simplify brush ticks
                            const d = new Date(unixTime);
                            return d.getMonth() + 1 + '/' + d.getDate();
                        }}
                        fill="rgba(255, 255, 255, 0.05)"
                        travellerWidth={8}
                    />
                </AreaChart>
            </ResponsiveContainer>
        </div>
    );
}
