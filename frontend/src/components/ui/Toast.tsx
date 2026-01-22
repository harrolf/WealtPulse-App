
import { useToasts, toast } from '@/services/toast';
import { CheckCircle, XCircle, Info, AlertTriangle, X } from 'lucide-react';
import { cn } from '@/lib/utils';

const icons = {
    success: <CheckCircle className="w-5 h-5 text-emerald-400" />,
    error: <XCircle className="w-5 h-5 text-red-400" />,
    info: <Info className="w-5 h-5 text-blue-400" />,
    warning: <AlertTriangle className="w-5 h-5 text-amber-400" />,
};

const toastStyles = {
    success: "border-emerald-500/20 bg-emerald-500/10 text-emerald-50",
    error: "border-red-500/20 bg-red-500/10 text-red-50",
    info: "border-blue-500/20 bg-blue-500/10 text-blue-50",
    warning: "border-amber-500/20 bg-amber-500/10 text-amber-50",
};

export function ToastContainer() {
    const toasts = useToasts();

    return (
        <div className="fixed top-6 right-6 z-[9999] flex flex-col gap-3 pointer-events-none">
            {toasts.map((toastItem) => (
                <div
                    key={toastItem.id}
                    className={cn(
                        "pointer-events-auto flex items-start gap-3 p-4 rounded-xl border backdrop-blur-md shadow-2xl min-w-[320px] max-w-md animate-slide-in transition-all",
                        toastStyles[toastItem.type]
                    )}
                >
                    <div className="flex-shrink-0 mt-0.5">
                        {icons[toastItem.type]}
                    </div>
                    <div className="flex-grow text-sm font-medium leading-relaxed">
                        {toastItem.message}
                    </div>
                    <button
                        onClick={() => toast.remove(toastItem.id)}
                        className="flex-shrink-0 text-foreground/40 hover:text-foreground/80 transition-colors"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>
            ))}
        </div>
    );
}

// Add CSS animation to global styles if needed, or use tailwind classes.
// I'll assume we might need a custom animation.
