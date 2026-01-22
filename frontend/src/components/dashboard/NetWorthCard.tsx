import { Wallet } from 'lucide-react';
import { cn, formatCurrency } from '@/lib/utils';
import { useFormattedDateTime } from '@/utils/datetime';
import type { PortfolioSummary, PerformanceAdvanced } from '@/types/dashboard';
import type { Settings } from '@/types/settings';
import { PerformanceChart } from '@/components/charts/PerformanceChart';


interface NetWorthCardProps {
    summary?: PortfolioSummary;
    performanceDetail?: PerformanceAdvanced;
    isHistorical?: boolean;
    settings: Settings;
    isPerfLoading: boolean;
}

export function NetWorthCard({ summary, performanceDetail, isHistorical, settings, isPerfLoading }: NetWorthCardProps) {
    const { formatDate } = useFormattedDateTime();

    return (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className={cn(
                "lg:col-span-1 relative overflow-hidden rounded-2xl p-8 glass-strong border-primary/20 animate-slide-up transition-all h-[360px] flex flex-col justify-center",
                isHistorical && "border-amber-500/30 shadow-[0_0_20px_-5px_rgba(245,158,11,0.1)]"
            )}>
                <div className="absolute inset-0 gradient-primary opacity-5"></div>
                {/* Decorative circles */}
                <div className="absolute -top-24 -right-24 w-64 h-64 bg-white/10 rounded-full blur-3xl animate-pulse" />
                <div className="absolute -bottom-24 -left-24 w-64 h-64 bg-black/10 rounded-full blur-3xl" />

                <div className="relative z-10">
                    <h2 className="text-lg font-medium text-muted-foreground flex items-center gap-2">
                        <Wallet className="h-5 w-5 text-primary" />
                        {isHistorical ? `Net Worth (${formatDate(summary?.date || "")})` : "Net Worth"}
                    </h2>
                    <div className="mb-2">
                        <h3 className="text-4xl font-light tracking-tight text-foreground mt-4">
                            {formatCurrency(summary?.total_value || 0, summary?.main_currency || 'CHF', 0, settings.number_format)}
                        </h3>
                    </div>

                    {/* Secondary Currencies */}
                    <div className="flex flex-wrap gap-x-4 gap-y-2 text-sm text-muted-foreground/80 mb-6">
                        {summary?.currencies && Object.entries(summary.currencies)
                            .filter(([curr]) => curr !== summary.main_currency)
                            .map(([curr, val]) => (
                                <div key={curr} className="flex items-baseline gap-1">
                                    {formatCurrency(val, curr, 0, settings.number_format)}
                                </div>
                            ))
                        }
                    </div>

                    {/* MWR KPI - Highlighted */}
                    <div className="pt-6 border-t border-white/10">
                        <div className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Personal Return (MWR)</div>
                        <div className="flex items-baseline gap-2">
                            <span className={cn(
                                "text-2xl font-bold",
                                (performanceDetail?.mwr_annualized || 0) >= 0 ? "text-green-500" : "text-red-500"
                            )}>
                                {(performanceDetail?.mwr_annualized || 0) > 0 ? "+" : ""}
                                {(Number(performanceDetail?.mwr_annualized || 0) * 100).toFixed(2)}%
                            </span>
                            <span className="text-sm text-muted-foreground">annualized</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Chart Section (2 Cols) */}
            <div className="lg:col-span-2 relative overflow-hidden rounded-xl p-6 glass-strong animate-slide-up h-[360px]" style={{ animationDelay: '0.3s' }}>
                <div className="h-full">
                    <PerformanceChart
                        data={performanceDetail?.twr_series || []}
                        isLoading={isPerfLoading}
                        mainCurrency={summary?.main_currency || "USD"}
                    />
                </div>
            </div>
        </div>
    );
}
