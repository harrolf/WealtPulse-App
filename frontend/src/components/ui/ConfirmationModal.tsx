
import { Modal } from './Modal';
import { AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ConfirmationModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => void;
    title: string;
    message: string;
    confirmText?: string;
    cancelText?: string;
    variant?: 'danger' | 'warning' | 'info';
}

export function ConfirmationModal({
    isOpen,
    onClose,
    onConfirm,
    title,
    message,
    confirmText = "Confirm",
    cancelText = "Cancel",
    variant = 'danger'
}: ConfirmationModalProps) {

    if (!isOpen) return null;

    const isDanger = variant === 'danger';

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={
                <div className="flex items-center gap-2">
                    <AlertTriangle className={cn("h-5 w-5", isDanger ? "text-red-500" : "text-amber-500")} />
                    <span>{title}</span>
                </div>
            }
            className="max-w-md"
        >
            <div className="space-y-4">
                <p className="text-muted-foreground leading-relaxed">
                    {message}
                </p>
                <div className="flex justify-end gap-3 pt-4">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 rounded-lg hover:bg-muted/50 transition-colors text-sm font-medium"
                    >
                        {cancelText}
                    </button>
                    <button
                        onClick={() => {
                            onConfirm();
                            onClose();
                        }}
                        className={cn(
                            "px-4 py-2 rounded-lg text-white transition-all shadow-md active:scale-95 text-sm font-bold",
                            isDanger
                                ? "bg-red-500 hover:bg-red-600 hover:shadow-red-500/20"
                                : "bg-primary hover:bg-primary/90 hover:shadow-primary/20"
                        )}
                    >
                        {confirmText}
                    </button>
                </div>
            </div>
        </Modal>
    );
}
