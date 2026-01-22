import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/services/api';
import { cn } from '@/lib/utils';
import { Modal } from '../ui/Modal';


interface AddTransactionFormProps {
    assetId: number;
    assetName: string;
    onClose: () => void;
    onSuccess?: () => void;
}

export function AddTransactionForm({ assetId, assetName, onClose, onSuccess }: AddTransactionFormProps) {
    const queryClient = useQueryClient();
    const [formData, setFormData] = useState({
        type: 'Buy',
        date: new Date().toISOString().split('T')[0], // Today YYYY-MM-DD
        quantity_change: '',
        price_per_unit: '',
        fees: '',
        notes: '',
        created_at: new Date().toISOString()
    });

    const [isDirty, setIsDirty] = useState(false);

    const createTransactionMutation = useMutation({
        mutationFn: async (data: Omit<typeof formData, 'quantity_change' | 'price_per_unit' | 'fees'> & {
            quantity_change: number;
            price_per_unit: number;
            fees: number;
        }) => {
            // Backend expects ISO datetime
            const payload = {
                ...data,
                asset_id: assetId,
            };

            // Adjust quantity sign based on type
            let qty = data.quantity_change;
            if (data.type === 'Sell' || data.type === 'Transfer out') {
                qty = -Math.abs(qty);
            } else {
                qty = Math.abs(qty); // Buy, Transfer in, etc.
            }
            payload.quantity_change = qty;

            // Ensure date is ISO
            payload.date = new Date(data.date).toISOString();

            const response = await api.post('/transactions', payload);
            return response.data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['assets'] });
            queryClient.invalidateQueries({ queryKey: ['portfolio-summary'] });
            onSuccess?.();
            onClose();
        },
    });

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        createTransactionMutation.mutate({
            ...formData,
            quantity_change: parseFloat(formData.quantity_change),
            price_per_unit: parseFloat(formData.price_per_unit) || 0,
            fees: parseFloat(formData.fees) || 0,
        });
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
        setIsDirty(true);
    };

    return (
        <Modal
            isOpen={true}
            onClose={onClose}
            hasUnsavedChanges={isDirty}
            title={
                <div>
                    Add Transaction
                    <span className="text-sm font-normal text-muted-foreground ml-2">for {assetName}</span>
                </div>
            }
        >
            <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium mb-2">Type <span className="text-destructive">*</span></label>
                        <select
                            name="type"
                            value={formData.type}
                            onChange={handleChange}
                            className="w-full px-4 py-2 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50"
                        >
                            <option value="Buy">Buy</option>
                            <option value="Sell">Sell</option>
                            <option value="Value adjustment">Value Adjustment</option>
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium mb-2">Date <span className="text-destructive">*</span></label>
                        <input
                            type="date"
                            name="date"
                            value={formData.date}
                            onChange={handleChange}
                            required
                            className="w-full px-4 py-2 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50"
                        />
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium mb-2">Quantity <span className="text-destructive">*</span></label>
                        <input
                            type="number"
                            name="quantity_change"
                            value={formData.quantity_change}
                            onChange={handleChange}
                            required
                            step="any"
                            min="0"
                            className="w-full px-4 py-2 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50"
                            placeholder="0.00"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium mb-2">Price per Unit</label>
                        <input
                            type="number"
                            name="price_per_unit"
                            value={formData.price_per_unit}
                            onChange={handleChange}
                            step="any"
                            min="0"
                            className="w-full px-4 py-2 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50"
                            placeholder="0.00"
                        />
                    </div>
                </div>

                <div>
                    <label className="block text-sm font-medium mb-2">Fees (Optional)</label>
                    <input
                        type="number"
                        name="fees"
                        value={formData.fees}
                        onChange={handleChange}
                        step="any"
                        min="0"
                        className="w-full px-4 py-2 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50"
                        placeholder="0.00"
                    />
                </div>

                <div className="flex gap-3 pt-4">
                    <button type="button" onClick={onClose} className="flex-1 px-4 py-2 border border-border rounded-lg hover:bg-muted">
                        Cancel
                    </button>
                    <button
                        type="submit"
                        disabled={createTransactionMutation.isPending}
                        className={cn(
                            "flex-1 px-4 py-2 gradient-primary text-white rounded-lg",
                            createTransactionMutation.isPending && "opacity-50 cursor-not-allowed"
                        )}
                    >
                        {createTransactionMutation.isPending ? 'Saving...' : 'Add Transaction'}
                    </button>
                </div>
            </form>
        </Modal>
    );
}
