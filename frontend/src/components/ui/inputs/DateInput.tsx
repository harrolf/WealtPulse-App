import { cn } from "@/lib/utils";
import React, { useState, useEffect, useRef } from "react";
import { useFormattedDateTime, formatDisplayDate, parseInputDate } from "@/utils/datetime";
import { Calendar as CalendarIcon } from "lucide-react";

interface DateInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'> {
    value: string; // Expects ISO YYYY-MM-DD
    onChange: (e: { target: { value: string, name?: string } }) => void;
}

export const DateInput = React.forwardRef<HTMLInputElement, DateInputProps>(
    ({ className, value, onChange, name, ...props }, ref) => {
        const { currentDateFormat } = useFormattedDateTime();
        const [inputValue, setInputValue] = useState("");
        const dateInputRef = useRef<HTMLInputElement>(null);

        // Sync external value (ISO) to display value (Formatted)
        useEffect(() => {
            const formatted = formatDisplayDate(value, currentDateFormat as 'auto' | 'us' | 'eu' | 'ch');
            if (inputValue !== formatted) {
                setInputValue(formatted);
            }
            // eslint-disable-next-line react-hooks/exhaustive-deps
        }, [value, currentDateFormat]);

        const handleTextChange = (e: React.ChangeEvent<HTMLInputElement>) => {
            const rawVal = e.target.value;
            setInputValue(rawVal); // Update display immediately

            // Try to parse
            const iso = parseInputDate(rawVal, currentDateFormat as 'auto' | 'us' | 'eu' | 'ch');
            if (iso) {
                // Return ISO to parent if valid
                onChange({ target: { value: iso, name } });
            }
        };

        const handleBlur = () => {
            // On blur, force re-format to ensure validity or revert to last known good ISO
            if (value) {
                setInputValue(formatDisplayDate(value, currentDateFormat as 'auto' | 'us' | 'eu' | 'ch'));
            } else {
                // If invalid and we cleared it or it was never set, maybe keep as is or clear? 
                // If it didn't parse to a valid ISO, 'value' prop won't have updated.
                // So resetting to 'value' effectively reverts invalid input.
                setInputValue(formatDisplayDate(value, currentDateFormat as 'auto' | 'us' | 'eu' | 'ch'));
            }
        };

        const handleCalendarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
            const iso = e.target.value;
            if (iso) {
                onChange({ target: { value: iso, name } });
                // Text input will update via useEffect
            }
        };

        const triggerDatePicker = () => {
            if (dateInputRef.current) {
                if (typeof dateInputRef.current.showPicker === 'function') {
                    dateInputRef.current.showPicker();
                } else {
                    dateInputRef.current.focus();
                }
            }
        };

        return (
            <div className="relative group">
                <input
                    type="text"
                    className={cn(
                        "w-full px-4 py-2 bg-background border border-border rounded-lg",
                        "focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all font-mono text-sm pr-10",
                        className
                    )}
                    ref={ref}
                    value={inputValue}
                    onChange={handleTextChange}
                    onBlur={handleBlur}
                    placeholder={currentDateFormat === 'ch' ? "DD.MM.YYYY" : currentDateFormat === 'us' ? "MM/DD/YYYY" : "YYYY-MM-DD"}
                    {...props}
                />

                <button
                    type="button"
                    onClick={triggerDatePicker}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-primary transition-colors p-1"
                    tabIndex={-1}
                >
                    <CalendarIcon className="h-4 w-4" />
                </button>

                {/* Hidden Date Input for Picker */}
                <input
                    type="date"
                    ref={dateInputRef}
                    className="sr-only"
                    tabIndex={-1}
                    value={value || ""}
                    onChange={handleCalendarChange}
                />
            </div>
        );
    }
);
DateInput.displayName = "DateInput";
