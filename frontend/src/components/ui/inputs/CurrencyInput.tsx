
import { cn } from "@/lib/utils";
import React from "react";
import { ChevronDown } from "lucide-react";

interface CurrencyInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange'> {
    value: string | number;
    onChange: (value: string) => void;
    currency: string;
    onCurrencyChange?: (currency: string) => void;
    currencyOptions?: string[]; // If provided, renders a dropdown for currency
    placeholder?: string;
}

export const CurrencyInput = React.forwardRef<HTMLInputElement, CurrencyInputProps>(
    ({ className, value, onChange, currency, onCurrencyChange, currencyOptions, placeholder = "0.00", ...props }, ref) => {

        const isSelectable = !!(currencyOptions && currencyOptions.length > 0 && onCurrencyChange);

        return (
            <div className="relative flex rounded-lg shadow-sm">
                {isSelectable ? (
                    <div className="absolute inset-y-0 left-0 flex items-center">
                        <label htmlFor="currency-select" className="sr-only">Currency</label>
                        <select
                            id="currency-select"
                            name="currency"
                            value={currency}
                            onChange={(e) => onCurrencyChange?.(e.target.value)}
                            className="h-full py-0 pl-3 pr-7 border-transparent bg-transparent text-muted-foreground text-sm font-mono focus:ring-2 focus:ring-primary/50 rounded-l-lg cursor-pointer hover:text-foreground transition-colors appearance-none"
                        >
                            {currencyOptions.map((curr) => (
                                <option key={curr} value={curr}>{curr}</option>
                            ))}
                        </select>
                        <ChevronDown className="absolute right-2 h-3 w-3 text-muted-foreground pointer-events-none" />
                        <div className="h-4 w-px bg-border mx-1"></div>
                    </div>
                ) : (
                    <div className="absolute inset-y-0 left-0 flex items-center pl-3">
                        <span className="text-muted-foreground text-sm font-mono font-medium">
                            {currency}
                        </span>
                        <div className="h-4 w-px bg-border mx-2"></div>
                    </div>
                )}

                <input
                    type="number"
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    className={cn(
                        "block w-full rounded-lg border border-border bg-background px-4 py-2",
                        "focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all text-sm font-mono",
                        isSelectable ? "pl-20" : "pl-16", // Adjusted padding for left-side alignment
                        className
                    )}
                    placeholder={placeholder}
                    step="0.01"
                    ref={ref}
                    {...props}
                />
            </div>
        );
    }
);
CurrencyInput.displayName = "CurrencyInput";
