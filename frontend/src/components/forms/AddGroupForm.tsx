import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';

import { cn } from '@/lib/utils';
import { AddModal } from '../ui/AddModal';
import { FormLabel } from '../ui/inputs/FormLabel';
import type { PrimaryGroup } from '@/types/PrimaryGroup';
import { GroupsService } from '@/services/groups';

interface AddGroupFormProps {
    onClose: () => void;
    onSuccess?: (group: PrimaryGroup) => void;
}

const COLORS = [
    '#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6',
    '#ec4899', '#06b6d4', '#84cc16', '#6366f1', '#f97316'
];

export function AddGroupForm({ onClose, onSuccess }: AddGroupFormProps) {
    const queryClient = useQueryClient();

    const [formData, setFormData] = useState({
        name: '',
        color: COLORS[0],
        description: '',
    });

    const [isDirty, setIsDirty] = useState(false);

    const mutation = useMutation({
        mutationFn: async (data: Omit<PrimaryGroup, 'id' | 'user_id' | 'created_at'>) => {
            return GroupsService.create(data);
        },
        onSuccess: (data) => {
            queryClient.invalidateQueries({ queryKey: ['primary-groups'] });
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
        <AddModal
            isOpen={true}
            onClose={onClose}
            hasUnsavedChanges={isDirty}
            title={
                <span className="bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
                    Add New Primary Group
                </span>
            }
            onSubmit={handleSubmit}
            submitLabel="Add Group"
            isSubmitting={mutation.isPending}
        >
            <div className="space-y-6">
                <div>
                    <FormLabel required>Group Name</FormLabel>
                    <input
                        type="text"
                        value={formData.name}
                        onChange={(e) => {
                            setFormData(prev => ({ ...prev, name: e.target.value }));
                            setIsDirty(true);
                        }}
                        required
                        className="w-full px-4 py-2 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all"
                        placeholder="e.g. Retirement, Emergency Fund, Speculative"
                        autoFocus
                    />
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
                        placeholder="What is this group used for?"
                    />
                </div>

                <div>
                    <FormLabel>Color Theme</FormLabel>
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
        </AddModal>
    );
}
