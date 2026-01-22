import React from 'react';
import { cn } from "@/lib/utils";
import { useFormattedDateTime } from "@/utils/datetime";

interface FormattedTimeProps extends React.HTMLAttributes<HTMLSpanElement> {
    timestamp: string | Date | null | undefined;
    mode?: 'time' | 'date' | 'datetime';
    showTimezoneTooltip?: boolean;
    emptyValue?: string;
}

export function FormattedTime({
    timestamp,
    mode = 'time',
    showTimezoneTooltip = true,
    emptyValue = '-',
    className,
    ...props
}: FormattedTimeProps) {
    const { formatTime, formatDate, formatDateTime, currentTimezone } = useFormattedDateTime();

    if (!timestamp) {
        return <span className={cn("text-muted-foreground", className)} {...props}>{emptyValue}</span>;
    }

    let tsStr: string;
    try {
        tsStr = typeof timestamp === 'string' ? timestamp : timestamp.toISOString();
    } catch {
        return <span className={cn("text-destructive", className)} {...props}>Invalid Date</span>;
    }

    let display: string = '';

    try {
        let result: string;
        if (mode === 'time') {
            result = formatTime(tsStr);
        } else if (mode === 'date') {
            result = formatDate(tsStr);
        } else if (mode === 'datetime') {
            result = formatDateTime(tsStr);
        } else {
            result = formatTime(tsStr);
        }

        // Ensure we have a string
        display = String(result || '');
    } catch (e) {
        console.error('Error formatting time:', e, { timestamp, mode, tsStr });
        return <span className={cn("text-destructive", className)} {...props}>Format Error</span>;
    }

    let tooltip: string | undefined;
    try {
        tooltip = showTimezoneTooltip
            ? `${String(formatDateTime(tsStr))} (${currentTimezone})`
            : undefined;
    } catch (e) {
        console.error('Error creating tooltip:', e);
        tooltip = undefined;
    }

    return (
        <span
            title={tooltip}
            className={cn("cursor-help transition-colors hover:text-foreground", className)}
            {...props}
        >
            {display}
        </span>
    );
}
