import { Calendar, RotateCcw } from 'lucide-react';
import { useFormattedDateTime } from '@/utils/datetime';

interface HistoricalPillProps {
    isHistorical?: boolean;
    date?: string;
    onReturnToPresent: () => void;
}

export function HistoricalPill({ isHistorical, date, onReturnToPresent }: HistoricalPillProps) {
    const { formatDate } = useFormattedDateTime();

    if (!isHistorical) return null;

    return (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 animate-in slide-in-from-bottom-4 fade-in duration-300">
            <div className="bg-background/80 backdrop-blur-md border border-amber-500/30 shadow-lg shadow-amber-500/10 rounded-full px-5 py-2.5 flex items-center gap-3">
                <div className="flex items-center gap-2 text-amber-500">
                    <Calendar className="w-4 h-4" />
                    <span className="text-sm font-medium whitespace-nowrap">
                        Viewing {formatDate(date || "")}
                    </span>
                </div>
                <div className="h-4 w-px bg-border/50" />
                <button
                    onClick={onReturnToPresent}
                    className="text-xs font-medium hover:text-primary transition-colors flex items-center gap-1.5 whitespace-nowrap"
                >
                    <RotateCcw className="w-3 h-3" />
                    Return to Present
                </button>
            </div>
        </div>
    );
}
