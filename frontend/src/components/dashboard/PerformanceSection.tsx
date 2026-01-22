import { TrendingUp } from 'lucide-react';
import { cn, formatCurrency } from '@/lib/utils';
import type { PerformanceData, PortfolioSummary } from '@/types/dashboard';

import type { Settings } from '@/types/settings';

interface PerformanceSectionProps {
    performance?: PerformanceData;
    summary?: PortfolioSummary;
    settings: Settings;
}

export function PerformanceSection({ performance, summary, settings }: PerformanceSectionProps) {
    return (
        <div className="animate-slide-up" style={{ animationDelay: '0.4s' }}>
            <div className="glass-strong rounded-2xl p-6 border border-white/10">
                <h2 className="text-xl font-semibold mb-6 flex items-center gap-2">
                    <TrendingUp className="h-5 w-5 text-primary" />
                    Performance
                </h2>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Left: Overall Performance */}
                    <div className="lg:col-span-1 flex flex-col justify-center">
                        <div className="space-y-4">
                            <div className={cn(
                                "text-5xl font-light",
                                (performance?.performance_percent || 0) >= 0 ? "text-green-500" : "text-red-500"
                            )}>
                                {(performance?.performance_percent || 0) > 0 ? "+" : ""}
                                {Number(performance?.performance_percent || 0).toFixed(2)}%
                            </div>

                            <div className={cn(
                                "text-2xl font-medium flex items-center gap-2",
                                (performance?.change_value || 0) >= 0 ? "text-green-400" : "text-red-400"
                            )}>
                                <span className={cn(
                                    "inline-block w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent",
                                    (performance?.change_value || 0) >= 0
                                        ? "border-b-[8px] border-b-green-400"
                                        : "border-t-[8px] border-t-red-400 rotate-180"
                                )} />
                                {formatCurrency(performance?.change_value || 0, summary?.main_currency || 'CHF', 0, settings.number_format)}
                            </div>

                            {/* Progress Bar */}
                            <div className="pt-4">
                                <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                                    <div
                                        className={cn(
                                            "h-full rounded-full transition-all duration-500",
                                            (performance?.performance_percent || 0) >= 0 ? "bg-green-500" : "bg-red-500"
                                        )}
                                        style={{
                                            width: `${Math.min(Math.abs(performance?.performance_percent || 0) * 10, 100)}%`
                                        }}
                                    />
                                </div>
                            </div>

                            <div className="flex justify-between text-sm pt-2">
                                <div>
                                    <div className="text-muted-foreground text-xs">Start</div>
                                    <div className="font-medium">{formatCurrency(performance?.start_value || 0, summary?.main_currency || 'CHF', 0, settings.number_format)}</div>
                                </div>
                                <div className="text-right">
                                    <div className="text-muted-foreground text-xs">End</div>
                                    <div className="font-medium">{formatCurrency(performance?.end_value || 0, summary?.main_currency || 'CHF', 0, settings.number_format)}</div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Right: Category Breakdown */}
                    <div className="lg:col-span-2">
                        {performance?.breakdown && performance.breakdown.length > 0 ? (
                            <div className="space-y-3 max-h-[280px] overflow-y-auto custom-scrollbar pr-2">
                                {performance.breakdown.map((item, idx) => (
                                    <div key={idx} className="flex items-center justify-between text-sm py-2 px-3 rounded-lg hover:bg-white/5 transition-colors">
                                        <span className="text-foreground flex items-center gap-2 flex-1">
                                            <span className={cn(
                                                "w-2 h-2 rounded-full flex-shrink-0",
                                                item.performance_percent >= 0 ? "bg-green-500" : "bg-red-500"
                                            )} />
                                            <span className="font-medium">{item.name}</span>
                                        </span>
                                        <div className="flex items-center gap-4">
                                            <span className="text-muted-foreground font-mono">
                                                {formatCurrency(item.value, summary?.main_currency || 'CHF', 0, settings.number_format)}
                                            </span>
                                            <span className={cn(
                                                "font-semibold w-16 text-right",
                                                item.performance_percent >= 0 ? "text-green-400" : "text-red-400"
                                            )}>
                                                {item.performance_percent > 0 ? "+" : ""}{Number(item.performance_percent).toFixed(1)}%
                                            </span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="h-full flex items-center justify-center text-muted-foreground text-sm">
                                No performance breakdown available for this timeframe
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
