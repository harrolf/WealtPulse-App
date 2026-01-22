import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Calendar, TrendingUp, Check, X, Pencil, Trash2 } from 'lucide-react';
import api from '@/services/api';
import { DateInput } from '../ui/inputs/DateInput';
import { CurrencyInput } from '../ui/inputs/CurrencyInput';
import { formatCurrency } from '@/lib/utils';
import { useSettingsContext } from '@/contexts/SettingsContext';
import { useFormattedDateTime } from '@/utils/datetime';
import { Modal } from '../ui/Modal';
import { ConfirmationModal } from '../ui/ConfirmationModal';

interface RevalueAssetModalProps {
    assetId: number;
    assetName: string;
    currency: string;
    onClose: () => void;
}

interface PriceHistory {
    id: number;
    date: string;
    price: number;
    currency: string;
    source: string;
}

export function RevalueAssetModal({ assetId, assetName, currency, onClose }: RevalueAssetModalProps) {
    const { formatDate } = useFormattedDateTime();
    const { settings } = useSettingsContext();
    const queryClient = useQueryClient();
    const [newPrice, setNewPrice] = useState('');
    const [newDate, setNewDate] = useState(new Date().toISOString().split('T')[0]);

    const [error, setError] = useState<string | null>(null);

    // Fetch History
    const { data: history = [], isLoading } = useQuery({
        queryKey: ['asset-history', assetId],
        queryFn: async () => {
            const response = await api.get(`/assets/${assetId}/value-history`);
            return response.data as PriceHistory[];
        },
    });

    // Add Valuation Mutation
    const revalueMutation = useMutation({
        mutationFn: async () => {
            setError(null);
            const payload = {
                date: new Date(newDate).toISOString(),
                price: parseFloat(newPrice),
                currency: currency,
                source: "Manual"
            };
            const response = await api.post(`/assets/${assetId}/revalue`, payload);
            return response.data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['asset-history', assetId] });
            queryClient.invalidateQueries({ queryKey: ['assets'] });
            queryClient.invalidateQueries({ queryKey: ['portfolio-summary'] });
            setNewPrice('');
        },
        onError: (err: unknown) => {
            console.error("Revalue failed:", err);
            const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail || "Failed to add valuation. Please check inputs.";
            setError(detail);
        }
    });

    const [editingId, setEditingId] = useState<number | null>(null);
    const [editPrice, setEditPrice] = useState('');
    const [editDate, setEditDate] = useState('');

    const [deleteConfirmationId, setDeleteConfirmationId] = useState<number | null>(null);

    // Delete Mutation
    const deleteMutation = useMutation({
        mutationFn: async (historyId: number) => {
            const response = await api.delete(`/assets/value-history/${historyId}`);
            return response.data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['asset-history', assetId] });
            queryClient.invalidateQueries({ queryKey: ['assets'] }); // Update current asset value if it was the latest
            queryClient.invalidateQueries({ queryKey: ['portfolio-summary'] });
        },
        onError: (err: unknown) => {
            console.error("Delete failed:", err);
            setError("Failed to delete entry.");
        }
    });

    // Update Mutation
    const updateMutation = useMutation({
        mutationFn: async (historyId: number) => {
            const payload = {
                date: new Date(editDate).toISOString(),
                price: parseFloat(editPrice),
                currency: currency,
                source: "Manual"
            };
            const response = await api.put(`/assets/value-history/${historyId}`, payload);
            return response.data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['asset-history', assetId] });
            queryClient.invalidateQueries({ queryKey: ['assets'] });
            queryClient.invalidateQueries({ queryKey: ['portfolio-summary'] });
            setEditingId(null);
            setEditPrice('');
            setEditDate('');
        },
        onError: (err: unknown) => {
            console.error("Update failed:", err);
            setError("Failed to update entry.");
        }
    });

    const startEditing = (entry: PriceHistory) => {
        setEditingId(entry.id);
        setEditPrice(entry.price.toString());
        setEditDate(entry.date.split('T')[0]);
    };

    const cancelEditing = () => {
        setEditingId(null);
        setEditPrice('');
        setEditDate('');
    };

    const saveEdit = (id: number) => {
        if (!editPrice || !editDate) return;
        updateMutation.mutate(id);
    };

    const handleDelete = (id: number) => {
        setDeleteConfirmationId(id);
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!newPrice || !newDate) return;
        revalueMutation.mutate();
    };

    return (
        <>
            <Modal
                isOpen={true}
                onClose={onClose}
                hasUnsavedChanges={newPrice !== '' || editingId !== null}
                title={
                    <div className="flex items-center gap-2">
                        <TrendingUp className="h-6 w-6 text-primary" />
                        <div>
                            <h2 className="text-xl font-bold bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text">
                                Value History
                            </h2>
                            <p className="text-sm text-muted-foreground">{assetName}</p>
                        </div>
                    </div>
                }
                className="max-w-lg"
            >
                <div className="space-y-6">

                    {error && (
                        <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg text-sm text-destructive font-medium">
                            {error}
                        </div>
                    )}

                    {/* Add New Value Form */}
                    <div className="bg-muted/30 rounded-xl p-4 border border-border/50">
                        <h3 className="font-semibold text-sm mb-3 flex items-center gap-2">
                            <Plus className="h-4 w-4 text-primary" /> Add Valuation
                        </h3>
                        <form onSubmit={handleSubmit} className="flex gap-3">
                            <div className="flex-1">
                                <DateInput
                                    value={newDate}
                                    onChange={(e) => setNewDate(e.target.value)}
                                    required
                                />
                            </div>
                            <div className="flex-1">
                                <CurrencyInput
                                    value={newPrice}
                                    onChange={setNewPrice}
                                    currency={currency}
                                    required
                                />
                            </div>
                            <button
                                type="submit"
                                disabled={revalueMutation.isPending}
                                className="px-3 py-2 bg-primary text-primary-foreground rounded-lg font-medium text-sm hover:bg-primary/90 transition-colors disabled:opacity-50 h-[42px]"
                            >
                                {revalueMutation.isPending ? '...' : 'Add'}
                            </button>
                        </form>
                    </div>

                    {/* History List */}
                    <div className="space-y-3">
                        <h3 className="font-semibold text-sm text-muted-foreground flex items-center gap-2">
                            <Calendar className="h-4 w-4" /> History Log
                        </h3>

                        {isLoading ? (
                            <div className="flex justify-center py-8">
                                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
                            </div>
                        ) : history.length === 0 ? (
                            <div className="text-center py-8 text-sm text-muted-foreground border border-dashed border-border/50 rounded-lg">
                                No manual valuations recorded.
                            </div>
                        ) : (
                            <div className="divide-y divide-border/30 border border-border/50 rounded-lg overflow-hidden bg-muted/10">
                                {history.map((entry) => (
                                    <div key={entry.id} className="p-3 text-sm hover:bg-muted/30 transition-colors group min-h-[56px] flex items-center">
                                        {editingId === entry.id ? (
                                            <div className="flex items-center gap-3 w-full">
                                                <div className="w-[120px]">
                                                    <DateInput
                                                        value={editDate}
                                                        onChange={(e) => setEditDate(e.target.value)}
                                                        className="h-9 text-xs"
                                                    />
                                                </div>
                                                <div className="flex-1">
                                                    <CurrencyInput
                                                        value={editPrice}
                                                        onChange={setEditPrice}
                                                        currency={currency}
                                                        className="h-9 text-xs py-1"
                                                    />
                                                </div>
                                                <div className="flex items-center gap-1">
                                                    <button onClick={() => saveEdit(entry.id)} className="p-1.5 hover:bg-green-500/10 text-green-500 rounded bg-green-500/5 transition-colors" title="Save">
                                                        <Check className="h-4 w-4" />
                                                    </button>
                                                    <button onClick={cancelEditing} className="p-1.5 hover:bg-muted/30 text-muted-foreground rounded bg-muted/20 transition-colors" title="Cancel">
                                                        <X className="h-4 w-4" />
                                                    </button>
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="flex items-center justify-between w-full">
                                                <div className="font-mono text-muted-foreground w-[100px] shrink-0">
                                                    {entry.date ? formatDate(entry.date) : '-'}
                                                </div>
                                                <div className="flex items-center gap-4">
                                                    <div className="font-medium text-right">
                                                        {formatCurrency(entry.price, entry.currency, 2, settings.number_format)}
                                                    </div>
                                                    <div className="flex items-center gap-0.5 border-l border-border/20 pl-4 py-1">
                                                        <button
                                                            onClick={() => startEditing(entry)}
                                                            className="p-1.5 hover:bg-primary/10 text-primary/70 hover:text-primary rounded transition-colors"
                                                            title="Edit"
                                                        >
                                                            <Pencil className="h-3.5 w-3.5" />
                                                        </button>
                                                        <button
                                                            onClick={() => handleDelete(entry.id)}
                                                            className="p-1.5 hover:bg-destructive/10 text-destructive/70 hover:text-destructive rounded transition-colors"
                                                            title="Delete"
                                                        >
                                                            <Trash2 className="h-3.5 w-3.5" />
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </Modal>

            <ConfirmationModal
                isOpen={!!deleteConfirmationId}
                onClose={() => setDeleteConfirmationId(null)}
                onConfirm={() => {
                    if (deleteConfirmationId) deleteMutation.mutate(deleteConfirmationId);
                }}
                title="Delete Valuation"
                message="Are you sure you want to delete this historical valuation? This will affect historical charts."
                confirmText="Delete"
            />
        </>
    );
}
