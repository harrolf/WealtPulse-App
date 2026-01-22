import React from 'react';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Trash2 } from 'lucide-react';

interface EditModalProps {
    isOpen: boolean;
    onClose: () => void;
    title: React.ReactNode;
    children: React.ReactNode;
    onSubmit: (e: React.FormEvent) => void;
    isSubmitting?: boolean;
    submitLabel?: string;
    onDelete?: () => void;
    deleteLabel?: string;
    deleteDisabled?: boolean;
    deleteDisabledTooltip?: string;
    hasUnsavedChanges?: boolean;
    className?: string;
}

export function EditModal({
    isOpen,
    onClose,
    title,
    children,
    onSubmit,
    isSubmitting = false,
    submitLabel = 'Save Changes',
    onDelete,
    deleteLabel = 'Delete',
    deleteDisabled = false,
    deleteDisabledTooltip,
    hasUnsavedChanges = false,
    className
}: EditModalProps) {
    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={title}
            hasUnsavedChanges={hasUnsavedChanges}
            className={className}
        >
            <form onSubmit={onSubmit} className="flex flex-col h-full">
                <div className="flex-1 space-y-4">
                    {children}

                    {/* Warning when deletion is blocked */}
                    {onDelete && deleteDisabled && deleteDisabledTooltip && (
                        <div className="p-3 border-2 border-red-500/50 bg-red-500/10 rounded-lg">
                            <p className="text-sm text-red-600 dark:text-red-400 font-medium">
                                ⚠️ {deleteDisabledTooltip}
                            </p>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between gap-4 pt-6 mt-4 border-t border-border">
                    {/* Left Side: Delete */}
                    <div>
                        {onDelete && (
                            <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className={deleteDisabled ? "text-muted-foreground/50 cursor-not-allowed" : "text-muted-foreground hover:text-destructive hover:bg-destructive/10"}
                                onClick={() => !deleteDisabled && onDelete()}
                                disabled={deleteDisabled}
                                title={deleteDisabled ? deleteDisabledTooltip : undefined}
                            >
                                <Trash2 className="w-4 h-4 mr-2" />
                                {deleteLabel}
                            </Button>
                        )}
                    </div>

                    {/* Right Side: Cancel & Save */}
                    <div className="flex items-center gap-3">
                        <Button
                            type="button"
                            variant="ghost"
                            onClick={onClose}
                        >
                            Cancel
                        </Button>
                        <Button
                            type="submit"
                            variant="premium"
                            disabled={isSubmitting}
                            className="min-w-[100px]"
                        >
                            {isSubmitting ? 'Saving...' : submitLabel}
                        </Button>
                    </div>
                </div>
            </form>
        </Modal>
    );
}
