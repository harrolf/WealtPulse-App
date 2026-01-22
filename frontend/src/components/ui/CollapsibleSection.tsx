import { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { cn } from '@/lib/utils';

interface CollapsibleSectionProps {
    title: string;
    children: React.ReactNode;
    defaultOpen?: boolean;
    className?: string;
    action?: React.ReactNode;
}

export function CollapsibleSection({
    title,
    children,
    defaultOpen = false,
    className,
    action
}: CollapsibleSectionProps) {
    const [isOpen, setIsOpen] = useState(defaultOpen);

    return (
        <div className={cn("border border-border/50 rounded-xl overflow-hidden bg-card/30", className)}>
            <div
                className="w-full flex items-center justify-between p-4 bg-muted/20 hover:bg-muted/40 transition-colors select-none cursor-pointer"
                onClick={() => setIsOpen(!isOpen)}
            >
                <div className="flex items-center gap-2">
                    <span className="w-1 h-5 bg-primary rounded-full"></span>
                    <span className="font-semibold text-sm uppercase tracking-wide text-foreground/80">{title}</span>
                </div>
                <div className="flex items-center gap-2">
                    {action && <div onClick={e => e.stopPropagation()}>{action}</div>}
                    {isOpen ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                </div>
            </div>

            <div className={cn(
                "transition-all duration-300 ease-in-out border-t border-border/50",
                isOpen ? "max-h-[2000px] opacity-100" : "max-h-0 opacity-0 border-t-0"
            )}>
                <div className="p-4 space-y-4">
                    {children}
                </div>
            </div>
        </div>
    );
}
