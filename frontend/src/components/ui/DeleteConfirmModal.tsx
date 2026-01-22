import React from 'react';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { AlertCircle } from 'lucide-react';

interface DeleteConfirmModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => void;
    title: string;
    itemName?: string;
    message?: React.ReactNode;
    warning?: string;
    isDeleting?: boolean;
    confirmLabel?: string;
}

export function DeleteConfirmModal({
    isOpen,
    onClose,
    onConfirm,
    title,
    itemName,
    message,
    warning,
    isDeleting = false,
    confirmLabel = 'Remove'
}: DeleteConfirmModalProps) {
    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={itemName ? `Remove ${itemName}` : title}
            className="max-w-md"
        >
            <div className="flex flex-col h-full">
                <div className="flex-1 space-y-4">
                    {message ? (
                        <div className="text-foreground/90 py-2">
                            {message}
                        </div>
                    ) : (
                        <p className="text-muted-foreground">
                            Are you sure you want to remove <strong>{itemName}</strong>? This action cannot be undone.
                        </p>
                    )}

                    {warning && (
                        <div className="text-sm text-yellow-600 dark:text-yellow-500 bg-yellow-500/10 p-4 rounded-lg border border-yellow-500/20 leading-relaxed flex gap-3">
                            <AlertCircle className="h-5 w-5 shrink-0" />
                            <span>{warning}</span>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between gap-4 pt-6 mt-6 border-t border-border">
                    <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground hidden sm:inline">Are you sure?</span>
                        <Button
                            type="button"
                            variant="destructive"
                            size="sm"
                            onClick={onConfirm}
                            disabled={isDeleting}
                        >
                            {isDeleting ? 'Removing...' : confirmLabel}
                        </Button>
                    </div>

                    <Button
                        type="button"
                        variant="ghost"
                        onClick={onClose}
                    >
                        Cancel
                    </Button>
                </div>
            </div>
        </Modal>
    );
}
