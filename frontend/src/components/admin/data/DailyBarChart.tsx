import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend, Brush } from 'recharts';
import { useMemo } from 'react';
import { format, parseISO, eachHourOfInterval, startOfDay, endOfDay } from 'date-fns';
import { useQuery } from '@tanstack/react-query';
import api from '@/services/api';

interface DailyBarChartProps {
    data: Record<string, Record<string, number>>;
    startYear: number;
    startDate?: string;
    endDate?: string;
    onCurrencyClick?: (currency: string) => void;
    // onRangeChange is technically not needed for local zoom, but keeping in interface if needed later
    onRangeChange?: (startDate: string, endDate: string) => void;
}

type AggregationLevel = 'day' | 'week' | 'month' | 'hour';

export function DailyBarChart({ data, startYear, startDate, endDate, onCurrencyClick }: DailyBarChartProps) {

    // Determine Mode: Single Day or Range?
    const isSingleDay = useMemo(() => {
        if (!startDate || !endDate) return false;
        return startDate === endDate;
    }, [startDate, endDate]);


    // -------------------------------------------------------------------------
    // MODE A: SINGLE DAY (HOURLY CONTEXT)
    // -------------------------------------------------------------------------

    // If single day, we need the granular data for the ENTIRE day
    const { data: fullDayHourlyData } = useQuery({
        queryKey: ['market-granular-full-day', startDate],
        queryFn: async () => {
            if (!startDate) return {};
            const start = startOfDay(parseISO(startDate));
            const end = endOfDay(parseISO(startDate));

            const res = await api.get('/system/market-data/stats-granular', {
                params: {
                    start_date: start.toISOString(),
                    end_date: end.toISOString()
                }
            });
            return res.data;
        },
        enabled: isSingleDay && !!startDate,
        staleTime: 5 * 60 * 1000
    });

    const hourlyContextData = useMemo(() => {
        if (!isSingleDay || !startDate || !fullDayHourlyData) return [];

        const start = startOfDay(parseISO(startDate));
        const end = endOfDay(parseISO(startDate));
        const hours = eachHourOfInterval({ start, end });

        return hours.map(h => {
            // Backend returns keys like "2023-10-25 14:00:00"
            const keyPrefix = format(h, "yyyy-MM-dd HH");
            const foundKey = Object.keys(fullDayHourlyData).find(k => k.startsWith(keyPrefix));
            const hourData = foundKey ? fullDayHourlyData[foundKey] : {};

            return {
                date: h.toISOString(),
                displayLabel: format(h, 'HH:mm'),
                processedDate: h.getTime(),
                ...hourData
            };
        });
    }, [isSingleDay, startDate, fullDayHourlyData]);


    // -------------------------------------------------------------------------
    // MODE B: RANGE (DAILY CONTEXT)
    // -------------------------------------------------------------------------

    const dailyContextData = useMemo(() => {
        if (isSingleDay) return [];

        let start: Date;
        let end: Date;

        if (startDate && endDate) {
            start = parseISO(startDate);
            end = parseISO(endDate);
        } else {
            // Fallback to full startYear if no specific range
            start = new Date(startYear, 0, 1);
            end = new Date(startYear, 11, 31);
        }

        const allDays: string[] = [];
        const current = new Date(start);
        const endUnix = end.getTime();

        while (current.getTime() <= endUnix) {
            allDays.push(format(current, 'yyyy-MM-dd'));
            current.setDate(current.getDate() + 1);
            if (allDays.length > 366 * 5) break;
        }

        return allDays.map(dateStr => {
            const dayData = data[dateStr] || {};
            return {
                date: dateStr,
                displayLabel: format(parseISO(dateStr), 'MMM d'),
                processedDate: parseISO(dateStr).getTime(),
                ...dayData
            };
        });

    }, [isSingleDay, startDate, endDate, startYear, data]);


    // -------------------------------------------------------------------------
    // UNIFIED VIEW DATA
    // -------------------------------------------------------------------------

    const chartData = isSingleDay ? hourlyContextData : dailyContextData;
    const aggregationLevel: AggregationLevel = isSingleDay ? 'hour' : 'day';

    // Helper: Unique Currencies
    const currencies = useMemo(() => {
        const set = new Set<string>();
        Object.values(data).forEach(day => Object.keys(day).forEach(curr => set.add(curr)));
        return Array.from(set).sort();
    }, [data]);

    const COLORS = [
        "#3b82f6", "#ef4444", "#10b981", "#f59e0b", "#8b5cf6", "#ec4899",
        "#06b6d4", "#84cc16", "#d946ef", "#f97316", "#14b8a6", "#6366f1"
    ];

    if (chartData.length === 0) {
        return <div className="h-48 flex items-center justify-center text-muted-foreground">Loading data...</div>;
    }

    // -------------------------------------------------------------------------
    // RENDER (SINGLE CHART)
    // -------------------------------------------------------------------------
    return (
        <div className="w-full h-[350px]">
            <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                    <XAxis
                        dataKey="processedDate"
                        scale="time"
                        type="number"
                        domain={['dataMin', 'dataMax']}
                        tickFormatter={(unix) => {
                            const d = new Date(unix);
                            if (aggregationLevel === 'hour') return format(d, 'HH:mm');
                            return format(d, 'MMM d');
                        }}
                        tick={{ fill: '#6b7280', fontSize: 11 }}
                    />
                    <YAxis tick={{ fill: '#6b7280', fontSize: 11 }} />
                    <Tooltip
                        labelFormatter={(unix) => {
                            const d = new Date(unix);
                            if (aggregationLevel === 'hour') return format(d, 'MMM d, HH:mm');
                            return format(d, 'MMM d, yyyy');
                        }}
                        contentStyle={{ backgroundColor: '#1a1a1a', borderColor: '#333' }}
                        itemStyle={{ fontSize: 12 }}
                    />
                    <Legend
                        wrapperStyle={{ fontSize: '11px', cursor: 'pointer' }}
                        onClick={(e) => e.value && onCurrencyClick?.(e.value)}
                    />
                    {currencies.map((currency, index) => (
                        <Bar
                            key={currency}
                            dataKey={currency}
                            stackId="a" // Stacked Bar
                            fill={COLORS[index % COLORS.length]}
                            cursor="pointer"
                            onClick={() => onCurrencyClick?.(currency)}
                        />
                    ))}

                    {/* INTEGRATED SLIDER (Main Graph Context) */}
                    <Brush
                        dataKey="processedDate"
                        height={15}
                        stroke="#3b82f6"
                        fill="rgba(255, 255, 255, 0.05)"
                        tickFormatter={(unix) => {
                            const d = new Date(unix);
                            if (aggregationLevel === 'hour') return format(d, 'HH:mm');
                            return format(d, 'd');
                        }}
                        travellerWidth={10}
                    />
                </BarChart>
            </ResponsiveContainer>
        </div>
    );
}
