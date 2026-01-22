
import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import api from '@/services/api';
import { actionLog } from '@/services/actionLog';
import { Search, Trash2, Edit2 } from 'lucide-react';
import { useFormattedDateTime } from '@/utils/datetime';

import { EditMarketDataModal } from '../../modals/EditMarketDataModal';
import { DateInput } from '../../ui/inputs/DateInput';
import { ConfirmationModal } from '@/components/ui/ConfirmationModal';

import { DailyBarChart } from './DailyBarChart';

interface MarketDataPoint {
    id: number;
    currency: string;
    timestamp: string;
    rate: number;
}

interface MarketDataTableProps {
    stats?: Record<string, Record<string, number>>;
    startDate: string;
    endDate: string;
    onStartDateChange: (date: string) => void;
    onEndDateChange: (date: string) => void;
    currency: string;
    onCurrencyChange: (currency: string) => void;
}

export function MarketDataTable({
    stats,
    startDate,
    endDate,
    onStartDateChange,
    onEndDateChange,
    currency,
    onCurrencyChange
}: MarketDataTableProps) {
    const { formatDateTime } = useFormattedDateTime();
    // const [currency, setCurrency] = useState(''); // Moved to props
    const [limit] = useState(50);
    const [page, setPage] = useState(1);
    const [sortBy, setSortBy] = useState('date_desc');

    // Local override for chart brush
    const [brushStartDate, setBrushStartDate] = useState<string | null>(null);
    const [brushEndDate, setBrushEndDate] = useState<string | null>(null);

    // Effective dates for the query
    const effectiveStartDate = brushStartDate || startDate;
    const effectiveEndDate = brushEndDate || endDate;

    const [editingPoint, setEditingPoint] = useState<MarketDataPoint | null>(null);
    const [deleteConfirmationId, setDeleteConfirmationId] = useState<number | null>(null);
    const queryClient = useQueryClient();

    const { data: historyData, isLoading } = useQuery<{ items: MarketDataPoint[], total: number }>({
        queryKey: ['market-history-search', currency, limit, effectiveStartDate, effectiveEndDate, page, sortBy],
        queryFn: async () => {
            const response = await api.get('/system/market-data', {
                params: {
                    currency: currency || undefined,
                    limit,
                    offset: (page - 1) * limit,
                    sort_by: sortBy,
                    start_date: effectiveStartDate || undefined,
                    end_date: effectiveEndDate || undefined
                }
            });
            return response.data;
        }
    });

    const history = historyData?.items || [];
    const total = historyData?.total || 0;
    const totalPages = Math.ceil(total / limit);

    const handleSort = (key: string) => {
        if (sortBy.startsWith(key)) {
            setSortBy(sortBy.endsWith('desc') ? `${key}_asc` : `${key}_desc`);
        } else {
            setSortBy(`${key}_desc`);
        }
    };

    const confirmDelete = async () => {
        if (!deleteConfirmationId) return;
        try {
            await api.delete(`/system/market-data/${deleteConfirmationId}`);
            queryClient.invalidateQueries({ queryKey: ['market-history-search'] });
            queryClient.invalidateQueries({ queryKey: ['market-stats'] });
            queryClient.invalidateQueries({ queryKey: ['currency-history'] });
            actionLog.log(`Deleted market data point #${deleteConfirmationId}`, `Historical cleanup`, 'info');
        } catch (e) {
            actionLog.error(`Failed to delete data point`, e);
        } finally {
            setDeleteConfirmationId(null);
        }
    };

    const deletePoint = (id: number) => {
        setDeleteConfirmationId(id);
    };

    const handleUpdateRate = async (id: number, rate: number) => {
        try {
            await api.patch(`/system/market-data/${id}`, { rate });
            queryClient.invalidateQueries({ queryKey: ['market-history-search'] });
            queryClient.invalidateQueries({ queryKey: ['market-stats'] });
            queryClient.invalidateQueries({ queryKey: ['currency-history'] });
            actionLog.log(`Updated market data point #${id}`, `Historical correction`, 'info');
        } catch (e) {
            actionLog.error(`Failed to update data point`, e);
            throw e;
        }
    };

    return (
        <div className="space-y-6 animate-slide-up">
            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-end gap-6">
                <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
                    <div className="relative flex-1 min-w-[150px]">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <input
                            type="text"
                            placeholder="Currency..."
                            className="pl-9 pr-4 py-2 rounded-lg bg-white/5 border border-white/10 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 w-full lg:w-32"
                            value={currency}
                            onChange={(e) => onCurrencyChange(e.target.value.toUpperCase())}
                        />
                    </div>

                    <DateInput
                        value={startDate}
                        onChange={(e) => onStartDateChange(e.target.value)}
                        placeholder="Start Date"
                        className="w-32"
                    />

                    <DateInput
                        value={endDate}
                        onChange={(e) => onEndDateChange(e.target.value)}
                        placeholder="End Date"
                        className="w-32"
                    />


                </div>
            </div>

            {/* Daily Bar Chart (Drill-down) */}
            {stats && Object.keys(stats).length > 0 && (
                <div className="rounded-xl overflow-hidden border border-border/50 glass-strong p-4">
                    <h3 className="text-sm font-medium text-muted-foreground mb-4">Daily Coverage & Distribution</h3>
                    <DailyBarChart
                        data={stats}
                        startYear={new Date().getFullYear()}
                        startDate={startDate}
                        endDate={endDate}
                        onCurrencyClick={(curr) => onCurrencyChange(curr)}
                        onRangeChange={(start, end) => {
                            setBrushStartDate(start);
                            setBrushEndDate(end);
                            setPage(1); // Reset page on filter change
                        }}
                    />
                </div>
            )}

            <div className="rounded-xl overflow-hidden border border-border/50 glass-strong min-h-[400px]">
                <table className="w-full text-sm text-left">
                    <thead className="text-xs text-muted-foreground uppercase bg-muted/10">
                        <tr>
                            <th className="px-6 py-3">ID</th>
                            <th
                                className="px-6 py-3 cursor-pointer hover:text-white transition-colors select-none"
                                onClick={() => handleSort('rate')} // Technically sorting via backend param, backend only supports specific strings. 'rate' -> 'rate_desc'
                            >
                                Currency
                            </th>
                            <th
                                className="px-6 py-3 cursor-pointer hover:text-white transition-colors select-none"
                                onClick={() => handleSort('date')}
                            >
                                Timestamp {sortBy.includes('date') && (sortBy.endsWith('desc') ? '↓' : '↑')}
                            </th>
                            <th
                                className="px-6 py-3 cursor-pointer hover:text-white transition-colors select-none"
                                onClick={() => handleSort('rate')}
                            >
                                Rate (USD) {sortBy.includes('rate') && (sortBy.endsWith('desc') ? '↓' : '↑')}
                            </th>
                            <th className="px-6 py-3 text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-border/30">
                        {isLoading ? (
                            <tr><td colSpan={5} className="p-8 text-center text-muted-foreground">Loading history...</td></tr>
                        ) : history?.length === 0 ? (
                            <tr><td colSpan={5} className="p-8 text-center text-muted-foreground">No data found matching criteria.</td></tr>
                        ) : (
                            history?.map((point) => (
                                <tr key={point.id} className="hover:bg-muted/5 transition-colors group">
                                    <td className="px-6 py-3 font-mono text-xs text-muted-foreground">{point.id}</td>
                                    <td className="px-6 py-3 font-bold">{point.currency}</td>
                                    <td className="px-6 py-3 font-mono text-xs">
                                        {formatDateTime(point.timestamp)}
                                    </td>
                                    <td className="px-6 py-3 font-mono">{Number(point.rate ?? 0).toFixed(6)}</td>
                                    <td className="px-6 py-3 text-right opacity-0 group-hover:opacity-100 transition-opacity">
                                        <div className="flex justify-end gap-2">
                                            <button
                                                onClick={() => setEditingPoint(point)}
                                                className="p-1.5 hover:bg-white/10 rounded-md text-blue-400"
                                                title="Edit Rate"
                                            >
                                                <Edit2 className="h-4 w-4" />
                                            </button>
                                            <button
                                                onClick={() => deletePoint(point.id)}
                                                className="p-1.5 hover:bg-white/10 rounded-md text-red-400"
                                                title="Delete Point"
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {/* Pagination Controls */}
            <div className="flex items-center justify-between text-sm">
                <div className="text-muted-foreground">
                    Showing {history.length} of {total} records
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => setPage(page - 1)}
                        disabled={page === 1}
                        className="px-3 py-1.5 rounded-lg border border-white/10 hover:bg-white/5 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        Previous
                    </button>
                    <span className="text-muted-foreground">
                        Page {page} of {totalPages || 1}
                    </span>
                    <button
                        onClick={() => setPage(page + 1)}
                        disabled={page >= totalPages}
                        className="px-3 py-1.5 rounded-lg border border-white/10 hover:bg-white/5 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        Next
                    </button>
                </div>
            </div>

            {
                editingPoint && (
                    <EditMarketDataModal
                        isOpen={!!editingPoint}
                        onClose={() => setEditingPoint(null)}
                        onSave={(id, rate) => handleUpdateRate(id, rate)}
                        point={editingPoint}
                    />
                )
            }

            <ConfirmationModal
                isOpen={!!deleteConfirmationId}
                onClose={() => setDeleteConfirmationId(null)}
                onConfirm={confirmDelete}
                title="Delete Data Point"
                message="Are you sure you want to delete this historical market data point? This action cannot be undone."
                confirmText="Delete"
            />
        </div >
    );
}
