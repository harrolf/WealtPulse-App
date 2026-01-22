import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/services/api';
import { EditModal } from '../ui/EditModal';
import type { Custodian } from '@/types/Custodian';

interface EditCustodianFormProps {
    custodian: Custodian;
    onClose: () => void;
    onSuccess?: (custodian: Custodian) => void;
    onDelete?: () => void;
    deleteDisabled?: boolean;
    deleteDisabledTooltip?: string;
}

export function EditCustodianForm({
    custodian,
    onClose,
    onSuccess,
    onDelete,
    deleteDisabled,
    deleteDisabledTooltip
}: EditCustodianFormProps) {
    const queryClient = useQueryClient();

    const [formData, setFormData] = useState({
        name: custodian.name || '',
        type: custodian.type || 'Broker',
        website_url: custodian.website_url || '',
        notes: custodian.notes || '',
    });

    const [isDirty, setIsDirty] = useState(false);

    const mutation = useMutation({
        mutationFn: async (data: Partial<Custodian>) => {
            const response = await api.put(`/custodians/${custodian.id}`, data);
            return response.data;
        },
        onSuccess: (data) => {
            queryClient.invalidateQueries({ queryKey: ['custodians'] });
            queryClient.invalidateQueries({ queryKey: ['portfolio-allocation'] });
            onSuccess?.(data);
            onClose();
        },
    });

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        mutation.mutate(formData);
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
        setIsDirty(true);
    };

    return (
        <EditModal
            isOpen={true}
            onClose={onClose}
            title={
                <span className="bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
                    Edit Custodian
                </span>
            }
            hasUnsavedChanges={isDirty}
            onSubmit={handleSubmit}
            submitLabel="Save Changes"
            isSubmitting={mutation.isPending}
            onDelete={onDelete}
            deleteLabel="Delete Custodian"
            deleteDisabled={deleteDisabled}
            deleteDisabledTooltip={deleteDisabledTooltip}
        >
            <div className="space-y-4">
                <div>
                    <label className="block text-sm font-medium mb-2">Name <span className="text-destructive">*</span></label>
                    <input
                        type="text"
                        name="name"
                        value={formData.name}
                        onChange={handleChange}
                        required
                        className="w-full px-4 py-2 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all"
                        placeholder="e.g. Interactive Brokers, Ledger Nano"
                        autoFocus
                    />
                </div>

                <div>
                    <label className="block text-sm font-medium mb-2">Type</label>
                    <select
                        name="type"
                        value={formData.type}
                        onChange={handleChange}
                        className="w-full px-4 py-2 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all"
                    >
                        <option value="Broker">Broker</option>
                        <option value="Bank">Bank</option>
                        <option value="Exchange">Exchange</option>
                        <option value="Self-custody">Self-custody (Wallet)</option>
                        <option value="Physical">Physical Location</option>
                    </select>
                </div>

                <div>
                    <label className="block text-sm font-medium mb-2">Website (Optional)</label>
                    <input
                        type="text"
                        name="website_url"
                        value={formData.website_url || ''}
                        onChange={handleChange}
                        className="w-full px-4 py-2 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all"
                        placeholder="https://..."
                    />
                </div>

                <div>
                    <label className="block text-sm font-medium mb-2">Notes (Optional)</label>
                    <textarea
                        name="notes"
                        value={formData.notes || ''}
                        onChange={handleChange}
                        className="w-full px-4 py-2 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50 h-24 resize-none transition-all"
                        placeholder="Additional details..."
                    />
                </div>
            </div>
        </EditModal>
    );
}
