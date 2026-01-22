import { cn, formatCurrency } from '@/lib/utils';
import type { PerformanceData, PerformanceAdvanced, PortfolioSummary } from '@/types/dashboard';

import type { Settings } from '@/types/settings';

interface StatsOverviewProps {
    performance?: PerformanceData;
    performanceDetail?: PerformanceAdvanced;
    summary?: PortfolioSummary;
    settings: Settings;
}

export function StatsOverview({ performance, performanceDetail, summary, settings }: StatsOverviewProps) {
    return (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 animate-slide-up" style={{ animationDelay: '0.5s' }}>
            <div className="glass-card p-4 rounded-xl flex flex-col justify-between">
                <div className="text-muted-foreground text-xs uppercase">Net Invested</div>
                <div className="text-xl font-medium">{formatCurrency(performanceDetail?.net_invested || 0, summary?.main_currency || 'USD', 0, settings.number_format)}</div>
            </div>
            <div className="glass-card p-4 rounded-xl flex flex-col justify-between">
                <div className="text-muted-foreground text-xs uppercase">Strategy Return (TWR)</div>
                <div className={cn("text-xl font-medium", (performance?.performance_percent || 0) >= 0 ? "text-green-400" : "text-red-400")}>
                    {performance?.performance_percent ? Number(performance.performance_percent).toFixed(2) : "0.00"}%
                </div>
            </div>
            <div className="glass-card p-4 rounded-xl flex flex-col justify-between">
                <div className="text-muted-foreground text-xs uppercase">Absolute Gain</div>
                <div className={cn("text-xl font-medium", (performance?.change_value || 0) >= 0 ? "text-green-400" : "text-red-400")}>
                    {formatCurrency(performance?.change_value || 0, summary?.main_currency || 'USD', 0, settings.number_format)}
                </div>
            </div>
            <div className="glass-card p-4 rounded-xl flex flex-col justify-between">
                <div className="text-muted-foreground text-xs uppercase">Assets</div>
                <div className="text-xl font-medium">{summary?.total_assets || 0}</div>
            </div>
        </div>
    );
}
