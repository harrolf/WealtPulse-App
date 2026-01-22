import { ArrowUp, ArrowDown, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';

interface TrendIndicatorProps {
    value: number | null | undefined;
    onClick?: () => void;
    className?: string;
    showIcon?: boolean;
}

export function TrendIndicator({ value, onClick, className, showIcon = true }: TrendIndicatorProps) {
    if (value === null || value === undefined) {
        return <span className="text-muted-foreground text-sm">-</span>;
    }

    const isPositive = value > 0;
    const isNegative = value < 0;
    const isNeutral = value === 0;

    return (
        <div
            onClick={onClick}
            className={cn(
                "flex items-center gap-1 text-sm font-medium cursor-pointer transition-transform hover:scale-105 select-none",
                isPositive && "text-emerald-500",
                isNegative && "text-red-500",
                isNeutral && "text-muted-foreground",
                className
            )}
        >
            {showIcon && (
                <>
                    {isPositive && <ArrowUp className="w-3 h-3" />}
                    {isNegative && <ArrowDown className="w-3 h-3" />}
                    {isNeutral && <Minus className="w-3 h-3" />}
                </>
            )}
            <span>{Math.abs(value).toFixed(1)}%</span>
        </div>
    );
}
