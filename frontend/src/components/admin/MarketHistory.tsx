
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '@/services/api';
import { History, LayoutGrid, List } from 'lucide-react';
// import { DailyBarChart } from './data/DailyBarChart';
import { DailyHeatmap } from './data/DailyHeatmap';
import { MonthlyHeatmap } from './data/MonthlyHeatmap';
import { MarketDataTable } from './data/MarketDataTable';
import { cn } from '@/lib/utils';
// import { useFormattedDateTime } from '@/utils/datetime';
import { format, endOfMonth } from 'date-fns';

interface MarketDataStats {
    daily: Record<string, number>;
    daily_breakdown: Record<string, Record<string, number>>;
    monthly: Record<string, number>;
    years: number[];
}

export function MarketHistoryTable() {
    // const { formatDate } = useFormattedDateTime();
    const [view, setView] = useState<'overview' | 'data'>('overview');
    const [overviewCurrency, setOverviewCurrency] = useState('');
    const [statsYear, setStatsYear] = useState<number>(new Date().getFullYear());

    // Filter State (lifted from MarketDataTable)
    const [filterStartDate, setFilterStartDate] = useState('');
    const [filterEndDate, setFilterEndDate] = useState('');

    const handleMonthClick = (year: number, month: number) => {
        // month is 1-12
        const start = new Date(year, month - 1, 1);
        const end = endOfMonth(start);

        setFilterStartDate(format(start, 'yyyy-MM-dd'));
        setFilterEndDate(format(end, 'yyyy-MM-dd'));
        setView('data');
    };

    const handleDayClick = (dateStr: string) => {
        setFilterStartDate(dateStr);
        setFilterEndDate(dateStr);
        setView('data');
    };


    const { data: stats } = useQuery<MarketDataStats>({
        queryKey: ['market-stats', overviewCurrency],
        queryFn: async () => {
            const response = await api.get('/system/market-data/stats', {
                params: { currency: overviewCurrency || undefined }
            });
            return response.data;
        }
    });

    return (
        <div className="space-y-6 animate-slide-up">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div className="space-y-1">
                    <h2 className="text-2xl font-semibold flex items-center gap-2">
                        <History className="h-6 w-6 text-primary" />
                        Market History Explorer
                    </h2>
                    <p className="text-sm text-muted-foreground">Inspect coverage and manage historical data.</p>
                </div>

                <div className="flex items-center gap-2">
                    {/* View Switcher */}
                    <div className="flex p-1 bg-white/5 rounded-lg border border-white/10">
                        <button
                            onClick={() => setView('overview')}
                            className={cn(
                                "flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-all",
                                view === 'overview' ? "bg-primary text-primary-foreground/75 shadow-sm" : "text-muted-foreground hover:text-white"
                            )}
                        >
                            <LayoutGrid className="h-4 w-4" />
                            Overview
                        </button>
                        <button
                            onClick={() => setView('data')}
                            className={cn(
                                "flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-all",
                                view === 'data' ? "bg-primary text-primary-foreground/75 shadow-sm" : "text-muted-foreground hover:text-white"
                            )}
                        >
                            <List className="h-4 w-4" />
                            Data Browser
                        </button>
                    </div>
                </div>
            </div>

            {view === 'overview' && (
                <div className="space-y-6 animate-fade-in">
                    {/* Overview Filters */}
                    <div className="flex justify-end">
                        <input
                            type="text"
                            placeholder="Filter Currency (e.g. BTC)..."
                            className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 w-64"
                            value={overviewCurrency}
                            onChange={(e) => setOverviewCurrency(e.target.value.toUpperCase())}
                        />
                    </div>

                    {stats && (
                        <div className="grid grid-cols-1 xl:grid-cols-20 gap-6">
                            <div className="xl:col-span-7 glass-card p-4 rounded-xl border border-white/10 space-y-3">
                                <h3 className="text-sm font-medium text-muted-foreground">Monthly Overview (All Time)</h3>
                                <MonthlyHeatmap
                                    data={stats.monthly}
                                    years={stats.years}
                                    onYearClick={(year: number) => setStatsYear(year)}
                                    onMonthClick={handleMonthClick}
                                />
                            </div>

                            <div className="xl:col-span-13 glass-card p-4 rounded-xl border border-white/10 space-y-3">
                                <div className="flex items-center justify-between">
                                    <h3 className="text-sm font-medium text-muted-foreground">
                                        Daily Distribution ({statsYear})
                                    </h3>
                                    <select
                                        value={statsYear}
                                        onChange={(e) => setStatsYear(Number(e.target.value))}
                                        className="bg-transparent border border-white/10 rounded-md text-xs px-2 py-1 focus:outline-none focus:ring-1 focus:ring-primary/50"
                                    >
                                        {stats?.years.map(y => (
                                            <option key={y} value={y}>{y}</option>
                                        ))}
                                        {!stats.years.includes(new Date().getFullYear()) && (
                                            <option value={new Date().getFullYear()}>{new Date().getFullYear()}</option>
                                        )}
                                    </select>
                                </div>
                                <DailyHeatmap
                                    data={stats.daily}
                                    startYear={statsYear}
                                    onDayClick={handleDayClick}
                                />
                            </div>
                        </div>
                    )}
                </div>
            )}

            {view === 'data' && (
                <div className="animate-fade-in">
                    <MarketDataTable
                        stats={stats?.daily_breakdown}
                        startDate={filterStartDate}
                        endDate={filterEndDate}
                        onStartDateChange={setFilterStartDate}
                        onEndDateChange={setFilterEndDate}
                        currency={overviewCurrency}
                        onCurrencyChange={(curr) => setOverviewCurrency(prev => prev === curr ? '' : curr)}
                    />
                </div>
            )}
        </div>
    );
}
