import React, { useState, useEffect } from 'react';
import { Edit2, Save } from 'lucide-react';
import { useFormattedDateTime } from '@/utils/datetime';
import { Modal } from '../ui/Modal';

interface MarketDataPoint {
    id: number;
    currency: string;
    timestamp: string;
    rate: number;
}

interface EditMarketDataModalProps {
    point: MarketDataPoint;
    isOpen: boolean;
    onClose: () => void;
    onSave: (id: number, rate: number) => Promise<void>;
}

export function EditMarketDataModal({ point, isOpen, onClose, onSave }: EditMarketDataModalProps) {
    const { formatDateTime } = useFormattedDateTime();
    const [rate, setRate] = useState<number | string>(point.rate || 0);
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        setRate(point.rate || 0);
    }, [point]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSaving(true);
        try {
            await onSave(point.id, Number(rate));
            onClose();
        } catch (error) {
            console.error('Failed to save rate:', error);
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={
                <div className="flex items-center gap-2">
                    <Edit2 className="h-5 w-5 text-primary" />
                    Edit Market Rate
                </div>
            }
        >
            <form onSubmit={handleSubmit} className="space-y-4">
                <div className="flex justify-between items-center text-sm p-3 rounded-lg bg-white/5 border border-white/5">
                    <div>
                        <span className="text-muted-foreground">Currency:</span>
                        <span className="ml-2 font-bold text-primary">{point.currency}</span>
                    </div>
                    <div>
                        <span className="text-muted-foreground">Date:</span>
                        <span className="ml-2 font-mono">{formatDateTime(point.timestamp)}</span>
                    </div>
                </div>

                <div className="space-y-1">
                    <label className="block text-sm font-medium mb-1">Rate (USD)</label>
                    <input
                        type="number"
                        step="any"
                        value={rate}
                        onChange={(e) => setRate(e.target.value)}
                        className="w-full px-4 py-2 rounded-lg bg-white/5 border border-white/10 text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 font-mono"
                        autoFocus
                    />
                </div>

                <div className="pt-4 flex justify-end gap-3">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-4 py-2 rounded-lg hover:bg-white/5 transition-colors text-sm font-medium"
                    >
                        Cancel
                    </button>
                    <button
                        type="submit"
                        disabled={isSaving}
                        className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors text-sm font-medium disabled:opacity-50"
                    >
                        {isSaving ? <Save className="h-4 w-4 animate-pulse" /> : <Save className="h-4 w-4" />}
                        Save Changes
                    </button>
                </div>
            </form>
        </Modal>
    );
}
