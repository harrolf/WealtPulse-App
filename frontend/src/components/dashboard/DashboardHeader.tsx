import { useRef } from 'react';
import { Sparkles, ChevronLeft, ChevronRight, Calendar } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useFormattedDateTime } from '@/utils/datetime';

interface DashboardHeaderProps {
    dateRange: { start: string; end: string; label: string };
    setDateRange: React.Dispatch<React.SetStateAction<{ start: string; end: string; label: string }>>;
    handleTimeframeChange: (timeframe: string) => void;
    handleDateStep: (direction: 'back' | 'forward') => void;
}

export function DashboardHeader({ dateRange, setDateRange, handleTimeframeChange, handleDateStep }: DashboardHeaderProps) {
    const { formatDate } = useFormattedDateTime();
    const dateInputRef = useRef<HTMLInputElement>(null);

    return (
        <div className="space-y-2">
            <div className="flex items-center gap-2">
                <Sparkles className="h-6 w-6 text-primary" />
                <h1 className="text-4xl font-bold bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text">Dashboard</h1>
            </div>
            <p className="text-muted-foreground text-lg">
                Your wealth overview at a glance
            </p>

            {/* Unified Date Controls */}
            <div className="flex flex-col items-end gap-2">
                {/* Timeframe Tabs */}
                <div className="flex items-center bg-muted/50 p-1 rounded-lg border border-border/50">
                    {['1d', '1w', '1m', '3m', 'ytd', '1y', 'all'].map((frame) => (
                        <button
                            key={frame}
                            onClick={() => handleTimeframeChange(frame)}
                            className={cn(
                                "px-3 py-1.5 rounded-md text-xs font-medium transition-all duration-200",
                                dateRange.label === frame
                                    ? "bg-background text-foreground shadow-sm"
                                    : "text-muted-foreground hover:text-foreground hover:bg-background/50"
                            )}
                        >
                            {frame.toUpperCase()}
                        </button>
                    ))}
                </div>

                {/* Snapshot Date Picker with Navigation */}
                <div className="flex items-center gap-1 bg-background/50 border border-border rounded-lg p-0.5">
                    <button
                        onClick={() => handleDateStep('back')}
                        className="p-1 hover:bg-muted rounded-md text-muted-foreground hover:text-foreground transition-colors z-20"
                        title="Previous Day"
                    >
                        <ChevronLeft className="w-4 h-4" />
                    </button>

                    <div
                        className={cn(
                            "flex items-center gap-2 px-2 py-1 cursor-pointer rounded transition-colors group relative",
                            dateRange.end ? "text-amber-500" : "text-foreground hover:bg-muted"
                        )}
                        onClick={() => {
                            try {
                                dateInputRef.current?.showPicker();
                            } catch {
                                // Fallback for older browsers or if showPicker fails
                                dateInputRef.current?.click();
                            }
                        }}
                    >
                        <Calendar className="w-4 h-4" />
                        <span className="text-sm font-medium w-[90px] text-center">
                            {dateRange.end ? formatDate(dateRange.end) : "Today"}
                        </span>

                        {/* Hidden Input for Picker Trigger */}
                        <input
                            ref={dateInputRef}
                            type="date"
                            value={dateRange.end}
                            max={new Date().toISOString().split('T')[0]}
                            onChange={(e) => {
                                const dateStr = e.target.value;
                                const isToday = dateStr === new Date().toISOString().split('T')[0];
                                setDateRange(prev => ({
                                    ...prev,
                                    end: isToday ? "" : dateStr,
                                    label: 'custom'
                                }));
                            }}
                            className="absolute inset-0 opacity-0 w-full h-full pointer-events-none"
                            style={{ visibility: 'hidden', position: 'absolute', pointerEvents: 'none' }}
                        />
                    </div>

                    <button
                        onClick={() => handleDateStep('forward')}
                        disabled={!dateRange.end || dateRange.end === new Date().toISOString().split('T')[0]}
                        className="p-1 hover:bg-muted rounded-md text-muted-foreground hover:text-foreground transition-colors disabled:opacity-30 disabled:hover:bg-transparent disabled:cursor-not-allowed z-20"
                        title="Next Day"
                    >
                        <ChevronRight className="w-4 h-4" />
                    </button>
                </div>
            </div>
        </div>
    );
}
