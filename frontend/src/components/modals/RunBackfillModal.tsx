import React, { useState } from 'react';
import { RefreshCcw } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { DateInput } from '../ui/inputs/DateInput';
import { CurrencySelect } from '../ui/inputs/CurrencySelect';

interface RunBackfillModalProps {
    isOpen: boolean;
    onClose: () => void;
    onRun: (params: { currency: string; start_date: string; end_date: string; force?: boolean }) => void;
    initialCurrency?: string;
}

export function RunBackfillModal({ isOpen, onClose, onRun, initialCurrency }: RunBackfillModalProps) {
    const [currency, setCurrency] = useState(initialCurrency || 'EUR');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
    const [force, setForce] = useState(false);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!currency || !startDate || !endDate) return;
        onRun({ currency, start_date: startDate, end_date: endDate, force });
        onClose();
    };

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={
                <div className="flex items-center gap-2">
                    <RefreshCcw className="h-5 w-5 text-primary" />
                    <span>Run Market Data Backfill</span>
                </div>
            }
            className="max-w-xl"
        >
            <form onSubmit={handleSubmit} className="space-y-6">
                <div className="space-y-4">
                    <p className="text-sm text-muted-foreground">
                        Fetch and populate missing market data from external providers.
                    </p>

                    <div>
                        <label className="block text-sm font-medium mb-1.5 text-muted-foreground">Target Currency</label>
                        <CurrencySelect
                            value={currency}
                            onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setCurrency(e.target.value)}
                            className="w-full bg-white/5 border-white/10 text-foreground rounded-lg px-3 py-2 focus:ring-2 focus:ring-primary/50 outline-none transition-all"
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-6">
                        <div>
                            <label className="block text-sm font-medium mb-1.5 text-muted-foreground">Start Date</label>
                            <DateInput
                                value={startDate}
                                onChange={(e) => setStartDate(e.target.value)}
                                className="w-full"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium mb-1.5 text-muted-foreground">End Date</label>
                            <DateInput
                                value={endDate}
                                onChange={(e) => setEndDate(e.target.value)}
                                className="w-full"
                            />
                        </div>
                    </div>

                    <div className="flex items-center gap-3 p-4 rounded-lg bg-orange-500/10 border border-orange-500/20">
                        <input
                            type="checkbox"
                            id="force"
                            checked={force}
                            onChange={(e) => setForce(e.target.checked)}
                            className="w-4 h-4 rounded border-orange-500/50 bg-transparent text-orange-500 focus:ring-orange-500/50"
                        />
                        <label htmlFor="force" className="text-sm text-orange-200 cursor-pointer select-none">
                            <strong>Force Refresh:</strong> Overwrite existing data points.
                        </label>
                    </div>
                </div>

                <div className="flex justify-end gap-3 pt-2">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-4 py-2 rounded-lg hover:bg-muted/50 transition-colors text-sm"
                    >
                        Cancel
                    </button>
                    <button
                        type="submit"
                        className="flex items-center gap-2 px-6 py-2.5 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-all font-medium shadow-lg shadow-primary/20 hover:shadow-primary/30"
                    >
                        <RefreshCcw className="h-4 w-4" />
                        Run Backfill
                    </button>
                </div>
            </form>
        </Modal>
    );
}
