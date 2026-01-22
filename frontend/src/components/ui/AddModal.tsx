import React from 'react';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';

interface AddModalProps {
    isOpen: boolean;
    onClose: () => void;
    title: React.ReactNode;
    children: React.ReactNode;
    onSubmit: (e: React.FormEvent) => void;
    isSubmitting?: boolean;
    submitLabel?: string;
    hasUnsavedChanges?: boolean;
    className?: string;
}

export function AddModal({
    isOpen,
    onClose,
    title,
    children,
    onSubmit,
    isSubmitting = false,
    submitLabel = 'Create',
    hasUnsavedChanges = false,
    className
}: AddModalProps) {
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
                </div>

                {/* Footer */}
                <div className="flex items-center justify-end gap-3 pt-6 mt-4 border-t border-border">
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
                        {isSubmitting ? 'Creating...' : submitLabel}
                    </Button>
                </div>
            </form>
        </Modal>
    );
}
