import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { useFormattedDateTime } from '@/utils/datetime';
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip";

interface DailyHeatmapProps {
    data: Record<string, number>; // "YYYY-MM-DD": count
    startYear: number;
    onDayClick?: (date: string) => void;
}

export function DailyHeatmap({ data, startYear, onDayClick }: DailyHeatmapProps) {
    const { formatDate, currentTimezone } = useFormattedDateTime();
    const days = Array.from({ length: 31 }, (_, i) => i + 1); // 1-31

    // Generate 24 months: intelligently handle current year vs past years
    const monthsToDisplay = Array.from({ length: 24 }, (_, i) => {
        const now = new Date();
        const currentYear = now.getFullYear();
        const currentMonth = now.getMonth(); // 0-indexed (0 = January)

        // If viewing current year, start from current month
        // Otherwise, start from December of selected year
        const startMonth = (startYear === currentYear) ? currentMonth : 11;

        // Calculate date by subtracting 'i' months from the starting month
        const date = new Date(startYear, startMonth - i, 1);
        return { year: date.getFullYear(), monthIndex: date.getMonth() };
    });

    // Calculate expected data points per day based on number of unique currencies
    // Extract unique currencies from the data keys (format: "YYYY-MM-DD")
    const allCounts = Object.values(data).filter(v => v > 0);
    const maxCount = allCounts.length > 0 ? Math.max(...allCounts) : 0;

    // Estimate currencies: use the max count as a proxy for "expected data points per day"
    // If max is 15, we expect ~15 data points per day when all currencies are tracked
    const expectedPerDay = maxCount > 0 ? maxCount : 1;

    const getColor = (count: number, isToday: boolean) => {
        // Missing data: black/white border
        if (!count) return "bg-black border-2 border-white/30";

        // Current day: pulsating blue border
        if (isToday) return "bg-blue-500 border-2 border-blue-300 animate-pulse";

        // Context-aware colors based on expected coverage
        const coverage = count / expectedPerDay;

        // < 40% coverage: red (missing most currencies)
        if (coverage < 0.4) return "bg-red-600 border border-red-600";
        // 40-60% coverage: orange (missing some currencies)
        if (coverage < 0.6) return "bg-orange-600 border border-orange-600";
        // 60-80% coverage: yellow (mostly complete)
        if (coverage < 0.8) return "bg-yellow-500 border border-yellow-500";
        // 80-95% coverage: lime (nearly complete)
        if (coverage < 0.95) return "bg-lime-500 border border-lime-500";
        // >= 95% coverage: green (complete or near-complete)
        return "bg-green-500 border border-green-500";
    };

    const getTodayDateStr = () => {
        try {
            // Use en-CA for YYYY-MM-DD format
            return new Intl.DateTimeFormat('en-CA', {
                timeZone: currentTimezone === 'auto' ? undefined : currentTimezone
            }).format(new Date());
        } catch {
            return format(new Date(), 'yyyy-MM-dd');
        }
    };

    const todayDateStr = getTodayDateStr();

    return (
        <div className="w-full overflow-x-auto pb-2">
            <div className="min-w-max">
                {/* Rows: Months (23 of them) */}
                <div className="space-y-1">
                    {monthsToDisplay.map(({ year, monthIndex }, index) => {
                        const monthName = format(new Date(year, monthIndex, 1), 'MMM yyyy');
                        // Add a separator or indicator when year changes?
                        const showYearLabel = monthIndex === 0 || index === 0;

                        return (
                            <div key={`${year}-${monthIndex}`} className="flex gap-2 items-center">
                                <div className={cn(
                                    "w-16 shrink-0 text-[10px] text-muted-foreground font-mono font-medium text-left",
                                    showYearLabel ? "text-white/80" : ""
                                )}>
                                    {monthName}
                                </div>
                                <div className="grid gap-1 flex-1" style={{ gridTemplateColumns: 'repeat(31, minmax(0, 1fr))' }}>
                                    {days.map(day => {
                                        // Handle leap years/months with < 31 days
                                        const date = new Date(year, monthIndex, day);
                                        const isMyMonth = date.getMonth() === monthIndex;

                                        if (!isMyMonth) {
                                            return <div key={day} className="w-3 h-3" />; // Blank spacer
                                        }

                                        const dateStr = format(date, 'yyyy-MM-dd');
                                        const count = data[dateStr] || 0;
                                        const isToday = dateStr === todayDateStr;

                                        return (
                                            <TooltipProvider key={day}>
                                                <Tooltip delayDuration={0}>
                                                    <TooltipTrigger>
                                                        <div
                                                            className={cn(
                                                                "w-3 h-3 rounded-none transition-all cursor-default",
                                                                getColor(count, isToday),
                                                                onDayClick && "cursor-pointer hover:ring-1 hover:ring-white"
                                                            )}
                                                            onClick={() => onDayClick?.(dateStr)}
                                                        />
                                                    </TooltipTrigger>
                                                    <TooltipContent className="text-xs font-bold bg-black/90 border-white/10">
                                                        <div className="font-normal text-[10px] text-muted-foreground mb-1">
                                                            {formatDate(date.toISOString())}
                                                        </div>
                                                        <p>{count} data points</p>
                                                    </TooltipContent>
                                                </Tooltip>
                                            </TooltipProvider>
                                        );
                                    })}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
            {/* Legend */}
            <div className="flex items-center justify-end gap-2 mt-4 text-[10px] text-muted-foreground">
                <span>0 (Missing)</span>
                <div className="w-3 h-3 bg-white/5 border border-white/10 rounded-none" title="0 points" />
                <div className="w-3 h-3 bg-red-600 rounded-none" title="1-2 points" />
                <div className="w-3 h-3 bg-amber-600 rounded-none" title="3-5 points" />
                <div className="w-3 h-3 bg-yellow-500 rounded-none" title="6-8 points" />
                <div className="w-3 h-3 bg-lime-500 rounded-none" title="9-12 points" />
                <div className="w-3 h-3 bg-green-500 rounded-none" title="13-15 points" />
                <div className="w-3 h-3 bg-emerald-500 rounded-none" title="15+ points" />
                <span>High</span>
            </div>
        </div>
    );
}
