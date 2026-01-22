import React, { createContext, useContext, useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '@/lib/utils';

interface TooltipContextType {
    open: boolean;
    setOpen: (open: boolean) => void;
    triggerRef: React.RefObject<HTMLDivElement | null>;
}

const TooltipContext = createContext<TooltipContextType | undefined>(undefined);

export const TooltipProvider = ({ children }: { children: React.ReactNode }) => {
    return <>{children}</>;
};

export const Tooltip = ({ children, delayDuration = 0 }: { children: React.ReactNode, delayDuration?: number }) => {
    const [open, setOpen] = useState(false);
    const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const triggerRef = useRef<HTMLDivElement>(null);

    const show = () => {
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        timeoutRef.current = setTimeout(() => setOpen(true), delayDuration);
    };

    const hide = () => {
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        setOpen(false);
    };

    return (
        <TooltipContext.Provider value={{ open, setOpen, triggerRef }}>
            <div
                ref={triggerRef}
                className="relative inline-block"
                onMouseEnter={show}
                onMouseLeave={hide}
                onFocus={show}
                onBlur={hide}
            >
                {children}
            </div>
        </TooltipContext.Provider>
    );
};

export const TooltipTrigger = ({ children }: { children: React.ReactNode }) => {
    return <>{children}</>;
};

export const TooltipContent = ({
    children,
    className
}: {
    children: React.ReactNode,
    className?: string
}) => {
    const context = useContext(TooltipContext);
    const [position, setPosition] = useState<{ top: number, left: number } | null>(null);

    React.useEffect(() => {
        if (context?.open && context.triggerRef.current) {
            const rect = context.triggerRef.current.getBoundingClientRect();
            setPosition({
                top: rect.top, // We will use -translate-y-full and margin to position above
                left: rect.left + rect.width / 2 // Center horizontally
            });
        }
    }, [context?.open, context?.triggerRef]);

    if (!context?.open || !position) return null;

    return createPortal(
        <div
            className={cn(
                "fixed z-[9999] px-3 py-1.5 text-xs text-white bg-black/90 rounded-md shadow-md border border-white/10 pointer-events-none",
                // Position logic: Centered horizontally, Moved Up by 100% (above top), dashed with margin
                "-translate-x-1/2 -translate-y-full mt-[-8px] animate-in fade-in zoom-in-95 duration-200",
                className
            )}
            style={{
                top: position.top,
                left: position.left
            }}
        >
            {children}
            {/* Arrow */}
            <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-black/90 border-r border-b border-white/10 rotate-45" />
        </div>,
        document.body
    );
};
