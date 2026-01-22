import React, { useEffect, useCallback, useState } from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ConfirmationModal } from './ConfirmationModal';

interface ModalProps {
    isOpen: boolean;
    onClose: () => void;
    title: React.ReactNode;
    children: React.ReactNode;
    hasUnsavedChanges?: boolean;
    className?: string; // For custom max-width or height
}

export function Modal({ isOpen, onClose, title, children, hasUnsavedChanges = false, className }: ModalProps) {
    const [showCloseConfirm, setShowCloseConfirm] = useState(false);

    const attemptClose = useCallback(() => {
        if (hasUnsavedChanges) {
            setShowCloseConfirm(true);
        } else {
            onClose();
        }
    }, [hasUnsavedChanges, onClose]);

    const handleConfirmClose = () => {
        setShowCloseConfirm(false);
        onClose();
    };

    // Handle ESC key
    useEffect(() => {
        const handleEsc = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                // If confirmation is already shown, ESC should cancel the confirmation (handled by ConfirmationModal's own ESC or we ignore)
                // If main modal is open and no confirmation, try to close
                if (!showCloseConfirm) {
                    attemptClose();
                }
            }
        };

        if (isOpen) {
            window.addEventListener('keydown', handleEsc);
        }

        return () => window.removeEventListener('keydown', handleEsc);
    }, [isOpen, attemptClose, showCloseConfirm]);

    // Prevent body scroll when open
    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = 'unset';
        }
        return () => { document.body.style.overflow = 'unset'; };
    }, [isOpen]);

    if (!isOpen) return null;

    return (
        <>
            <div
                className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 animate-fade-in backdrop-blur-sm"
                onClick={(e) => {
                    // If clicking the backdrop (and not a child), attempt close
                    if (e.target === e.currentTarget) {
                        attemptClose();
                    }
                }}
            >
                <div
                    className={cn(
                        "bg-card rounded-xl border border-border w-full shadow-2xl overflow-hidden animate-scale-in flex flex-col max-h-[90vh]",
                        "max-w-md", // Default width
                        className
                    )}
                    role="dialog"
                    aria-modal="true"
                >
                    {/* Header */}
                    <div className="flex items-center justify-between p-6 border-b border-border bg-card/50 backdrop-blur-sm z-10 shrink-0">
                        <div className="text-xl font-bold">
                            {title}
                        </div>
                        <button
                            onClick={attemptClose}
                            className="p-2 hover:bg-muted rounded-lg transition-colors text-muted-foreground hover:text-foreground"
                            aria-label="Close"
                        >
                            <X className="h-5 w-5" />
                        </button>
                    </div>

                    {/* Content */}
                    <div className="overflow-y-auto flex-1 p-6">
                        {children}
                    </div>
                </div>
            </div>

            <ConfirmationModal
                isOpen={showCloseConfirm}
                onClose={() => setShowCloseConfirm(false)}
                onConfirm={handleConfirmClose}
                title="Unsaved Changes"
                message="You have unsaved changes. Are you sure you want to close? Your changes will be lost."
                variant="warning"
                confirmText="Close without Saving"
            />
        </>
    );
}
