import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';

import { cn } from '@/lib/utils';
import { EditModal } from '../ui/EditModal';
import { FormLabel } from '../ui/inputs/FormLabel';
import type { Tag } from '@/types/Tag';
import { TagsService } from '@/services/tags';

interface EditTagFormProps {
    tag: Tag;
    onClose: () => void;
    onSuccess?: (tag: Tag) => void;
    onDelete?: () => void;
    deleteDisabled?: boolean;
    deleteDisabledTooltip?: string;
}

const COLORS = [
    '#6366f1', '#10b981', '#f59e0b', '#ef4444', '#3b82f6',
    '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16', '#f97316'
];

export function EditTagForm({
    tag,
    onClose,
    onSuccess,
    onDelete,
    deleteDisabled,
    deleteDisabledTooltip
}: EditTagFormProps) {
    const queryClient = useQueryClient();

    const [formData, setFormData] = useState({
        name: tag.name || '',
        color: tag.color || COLORS[0],
        description: tag.description || '',
    });

    const [isDirty, setIsDirty] = useState(false);

    const mutation = useMutation({
        mutationFn: async (data: Partial<Tag>) => {
            return TagsService.update(tag.id, data);
        },
        onSuccess: (data) => {
            queryClient.invalidateQueries({ queryKey: ['tags'] });
            queryClient.invalidateQueries({ queryKey: ['portfolio-allocation'] });
            onSuccess?.(data);
            onClose();
        },
    });

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        mutation.mutate(formData);
    };

    return (
        <EditModal
            isOpen={true}
            onClose={onClose}
            hasUnsavedChanges={isDirty}
            title={
                <span className="bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
                    Edit Tag
                </span>
            }
            onSubmit={handleSubmit}
            submitLabel="Save Changes"
            isSubmitting={mutation.isPending}
            onDelete={onDelete}
            deleteLabel="Delete Tag"
            deleteDisabled={deleteDisabled}
            deleteDisabledTooltip={deleteDisabledTooltip}
        >
            <div className="space-y-6">
                <div>
                    <FormLabel required>Tag Name</FormLabel>
                    <div className="relative">
                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground font-medium">#</span>
                        <input
                            type="text"
                            value={formData.name}
                            onChange={(e) => {
                                setFormData(prev => ({ ...prev, name: e.target.value }));
                                setIsDirty(true);
                            }}
                            required
                            className="w-full pl-8 pr-4 py-2 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all font-medium"
                            placeholder="e.g. Dividend, Tech, HighRisk"
                            autoFocus
                        />
                    </div>
                </div>

                <div>
                    <FormLabel>Description (Optional)</FormLabel>
                    <textarea
                        value={formData.description}
                        onChange={(e) => {
                            setFormData(prev => ({ ...prev, description: e.target.value }));
                            setIsDirty(true);
                        }}
                        className="w-full px-4 py-2 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all min-h-[80px]"
                        placeholder="What is this tag used for?"
                    />
                </div>

                <div>
                    <FormLabel>Tag Color</FormLabel>
                    <div className="flex flex-wrap gap-3 p-4 bg-muted/20 rounded-xl border border-border/50">
                        {COLORS.map(color => (
                            <button
                                key={color}
                                type="button"
                                onClick={() => {
                                    setFormData(prev => ({ ...prev, color }));
                                    setIsDirty(true);
                                }}
                                className={cn(
                                    "w-8 h-8 rounded-full border-2 transition-all",
                                    formData.color === color ? "border-white scale-125 shadow-lg" : "border-transparent opacity-60 hover:opacity-100"
                                )}
                                style={{ backgroundColor: color }}
                            />
                        ))}
                    </div>
                </div>
            </div>
        </EditModal>
    );
}
