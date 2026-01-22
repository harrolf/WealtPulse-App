import { cn } from '@/lib/utils';
import { useFormattedDateTime } from '@/utils/datetime';
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip";

interface MonthlyHeatmapProps {
    data: Record<string, number>; // "YYYY-MM": count
    years: number[];
    onYearClick?: (year: number) => void;
    onMonthClick?: (year: number, month: number) => void;
}

export function MonthlyHeatmap({ data, years, onYearClick, onMonthClick }: MonthlyHeatmapProps) {
    const { currentTimezone } = useFormattedDateTime();
    const months = [
        'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
        'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
    ];

    // Calculate min/max for dynamic colors
    const values = Object.values(data).filter(v => v > 0);
    const minValue = values.length > 0 ? Math.min(...values) : 0;
    const maxValue = values.length > 0 ? Math.max(...values) : 0;

    const getColor = (count: number, isCurrentMonth: boolean) => {
        // Missing data: black/white border
        if (!count) return "bg-black border-2 border-white/30";

        // Current month: pulsating blue border
        if (isCurrentMonth) return "bg-blue-500 border-2 border-blue-300 animate-pulse";

        // Dynamic color based on min/max range
        if (maxValue === minValue) {
            return "bg-green-500 border border-green-500";
        }

        const ratio = (count - minValue) / (maxValue - minValue);

        if (ratio <= 0.2) return "bg-red-600 border border-red-600";
        if (ratio <= 0.4) return "bg-orange-600 border border-orange-600";
        if (ratio <= 0.6) return "bg-yellow-500 border border-yellow-500";
        if (ratio <= 0.8) return "bg-lime-500 border border-lime-500";
        return "bg-green-500 border border-green-500";
    };

    const getCurrentYearMonth = () => {
        try {
            const dateStr = new Intl.DateTimeFormat('en-CA', {
                timeZone: currentTimezone === 'auto' ? undefined : currentTimezone
            }).format(new Date());
            return dateStr.substring(0, 7); // YYYY-MM
        } catch {
            const now = new Date();
            const year = now.getFullYear();
            const month = (now.getMonth() + 1).toString().padStart(2, '0');
            return `${year}-${month}`;
        }
    };

    const currentYearMonth = getCurrentYearMonth();

    if (years.length === 0) return <div className="text-muted-foreground text-sm">No historical data available.</div>;

    const sortedYears = [...years].sort((a, b) => b - a); // Descending

    return (
        <div className="w-full overflow-x-auto pb-2">
            <div className="min-w-max">
                {/* Rows */}
                <div className="space-y-1">
                    {sortedYears.map(year => (
                        <div key={year} className="flex items-center gap-2">
                            <div
                                className={cn(
                                    "w-12 shrink-0 text-[10px] font-mono text-muted-foreground text-right pr-2 transition-colors",
                                    onYearClick && "cursor-pointer hover:text-primary font-bold"
                                )}
                                onClick={() => onYearClick?.(year)}
                            >
                                {year}
                            </div>
                            <div className="flex-1 grid gap-1" style={{ gridTemplateColumns: 'repeat(12, minmax(0, 1fr))' }}>
                                {months.map((_, index) => {
                                    const monthNum = (index + 1).toString().padStart(2, '0');
                                    const key = `${year}-${monthNum}`;
                                    const count = data[key] || 0;
                                    const isCurrentMonth = key === currentYearMonth;

                                    return (
                                        <TooltipProvider key={key}>
                                            <Tooltip delayDuration={0}>
                                                <TooltipTrigger>
                                                    <div
                                                        className={cn(
                                                            "w-3 h-3 rounded-none transition-all cursor-default",
                                                            getColor(count, isCurrentMonth),
                                                            onMonthClick && "cursor-pointer hover:ring-1 hover:ring-white"
                                                        )}
                                                        onClick={() => onMonthClick?.(year, index + 1)}
                                                    />
                                                </TooltipTrigger>
                                                <TooltipContent className="text-xs font-bold bg-black/90 border-white/10">
                                                    <p>{count}</p>
                                                </TooltipContent>
                                            </Tooltip>
                                        </TooltipProvider>
                                    );
                                })}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
            {/* Legend */}
            <div className="flex items-center justify-end gap-2 mt-4 text-[10px] text-muted-foreground">
                <span>0 (Missing)</span>
                <div className="w-3 h-3 bg-white/5 border border-white/10 rounded-none" title="0 points" />
                <div className="w-3 h-3 bg-red-600 rounded-none" title="1-20 points" />
                <div className="w-3 h-3 bg-amber-600 rounded-none" title="20-50 points" />
                <div className="w-3 h-3 bg-yellow-500 rounded-none" title="50-100 points" />
                <div className="w-3 h-3 bg-lime-500 rounded-none" title="100-150 points" />
                <div className="w-3 h-3 bg-green-500 rounded-none" title="150-200 points" />
                <div className="w-3 h-3 bg-emerald-500 rounded-none" title="200+ points" />
                <span>High</span>
            </div>
        </div>
    );
}
