import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Coins, Plus, Trash2, Search, Star, Eye, X, AlertCircle, ArrowUpDown, Bitcoin } from 'lucide-react';
import api from '@/services/api';
import { DeleteConfirmModal } from '@/components/ui/DeleteConfirmModal';
import { cn, isValidCurrency, getCurrencySymbol, formatCurrency } from '@/lib/utils';
import { useSettingsContext } from '@/contexts/SettingsContext';
import { useFormattedDateTime } from '@/utils/datetime';
import { CurrencyHistoryChart } from '@/components/charts/CurrencyHistoryChart';
import { TrendIndicator } from '@/components/ui/TrendIndicator';
import { Modal } from '@/components/ui/Modal';
import { AddModal } from '@/components/ui/AddModal';
import { Button } from '@/components/ui/Button';
import { toast } from '@/services/toast';

// Known crypto tickers (sync with backend MarketDataConfig)
const KNOWN_CRYPTO = new Set([
    'BTC', 'ETH', 'SOL', 'ADA', 'DOT', 'DOGE',
    'SHIB', 'LINK', 'UNI', 'MATIC', 'NEXO', 'USDT',
    'CRO', 'LTC', 'XRP'
]);

interface Asset {
    id: number;
    currency: string;
    ticker_symbol?: string;
}

// Settings interface moved to global context

interface SortConfig {
    key: 'code' | 'usage' | null;
    direction: 'asc' | 'desc';
}

interface TrendData {
    base_currency: string;
    trends: Record<string, Record<string, number | null>>;
    last_updated: string;
}

export function Currencies() {
    const { formatDateTime, formatTime, currentTimezone } = useFormattedDateTime();
    const queryClient = useQueryClient();
    const { settings, updateSettings, isLoading: isLoadingSettings, isUpdating } = useSettingsContext();
    const [searchQuery, setSearchQuery] = useState('');
    const [showAddModal, setShowAddModal] = useState(false);
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [newCurrency, setNewCurrency] = useState('');
    const [addError, setAddError] = useState('');
    const [sortConfig, setSortConfig] = useState<SortConfig>({ key: null, direction: 'asc' });
    const [currencyToEdit, setCurrencyToEdit] = useState<string | null>(null);

    // Trend Modal State
    const [selectedTrend, setSelectedTrend] = useState<{ currency: string; period: string } | null>(null);

    // Removed local settings query as it is now in context

    const { data: assets, isLoading: isLoadingAssets } = useQuery<Asset[]>({
        queryKey: ['assets'],
        queryFn: async () => {
            const response = await api.get('/assets');
            return response.data;
        }
    });

    const { data: marketRates } = useQuery({
        queryKey: ['market-rates', settings?.main_currency],
        queryFn: async () => {
            const response = await api.get('/market/rates');
            return response.data;
        },
        enabled: !!settings?.main_currency,
        refetchInterval: 60000 // Refresh every minute
    });

    const { data: trendData } = useQuery<TrendData>({
        queryKey: ['currency-trends', settings?.main_currency],
        queryFn: async () => {
            const response = await api.get('/market/trends');
            return response.data;
        },
        enabled: !!settings?.main_currency,
        refetchInterval: 300000 // Refresh every 5 minutes
    });

    // Calculate currency usage
    const currencyUsage = (assets || []).reduce((acc, asset) => {
        // Count validation currency
        if (asset.currency) {
            acc[asset.currency] = (acc[asset.currency] || 0) + 1;
        }

        // Also count ticker symbol if it's a valid currency (e.g. BTC, ETH)
        // This ensures crypto assets valued in fiat still show the crypto currency as "used"
        if (asset.ticker_symbol && isValidCurrency(asset.ticker_symbol)) {
            const ticker = asset.ticker_symbol.toUpperCase();
            // Avoid double counting if ticker == currency (unlikely but possible)
            if (ticker !== asset.currency) {
                acc[ticker] = (acc[ticker] || 0) + 1;
            }
        }

        return acc;
    }, {} as Record<string, number>);

    const isLoading = isLoadingSettings || isLoadingAssets;

    // Local mutation replaced by context updateSettings, 
    // but some logic (like invalidating queries) is custom here.
    // However, context's updateSettings also invalidates 'settings'.
    // We might need to manually invalidate others or rely on context.
    // For now, we will use updateSettings directly in handlers.

    const handleCloseModal = () => {
        setShowAddModal(false);
        setCurrencyToEdit(null);
        setIsDeleteModalOpen(false);
    };

    const handleAddCurrency = async (e: React.FormEvent) => {
        e.preventDefault();
        const code = newCurrency.trim().toUpperCase();

        if (!code) return;
        if (code.length < 3 || code.length > 4) {
            setAddError('Currency code must be 3-4 characters long (e.g. USD, BTC, USDT)');
            return;
        }

        if (!isValidCurrency(code)) {
            setAddError('Please enter a valid ISO 4217 currency code');
            return;
        }

        const currentList = settings.currencies || [];
        if (currentList.includes(code)) {
            setAddError('Currency already exists');
            return;
        }

        try {
            await updateSettings({ currencies: [...currentList, code] });
            setNewCurrency('');
            setAddError('');
            setShowAddModal(false);
            // Invalidate dependent queries that SettingsContext doesn't handle
            queryClient.invalidateQueries({ queryKey: ['currency-trends'] });
        } catch {
            setAddError('Failed to add currency');
        }
    };

    const handleDeleteCurrency = (code: string, e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();

        if (code === settings.main_currency) {
            return;
        }

        setCurrencyToEdit(code);
        setIsDeleteModalOpen(true);
    };

    const setMainCurrency = (code: string) => {
        updateSettings({ main_currency: code });
    };

    const toggleSecondaryCurrency = (code: string) => {
        const current = settings.secondary_currencies || [];
        const isSelected = current.includes(code);

        if (isSelected) {
            updateSettings({ secondary_currencies: current.filter(c => c !== code) });
        } else {
            if (current.length >= 4) {
                toast.warning("You can select up to 4 currencies to display on the dashboard.");
                return;
            }
            updateSettings({ secondary_currencies: [...current, code] });
        }
    };

    const handleSort = (key: SortConfig['key']) => {
        setSortConfig(current => ({
            key,
            direction: current.key === key && current.direction === 'asc' ? 'desc' : 'asc',
        }));
    };

    // Combine settings currencies with any currencies actually in use
    const allCurrencies = Array.from(new Set([
        ...(settings?.currencies || []),
        ...Object.keys(currencyUsage)
    ]));

    const currencyNames = new Intl.DisplayNames(['en'], { type: 'currency' });

    const filteredCurrencies = allCurrencies
        .filter(c => {
            const query = searchQuery.toLowerCase();
            const code = c.toLowerCase();
            let name = '';
            try {
                name = currencyNames.of(c)?.toLowerCase() || '';
            } catch {
                // Ignore invalid currencies that Intl doesn't know
            }

            return code.includes(query) || name.includes(query);
        })
        .sort((a, b) => {
            if (sortConfig.key === 'code') {
                return sortConfig.direction === 'asc' ? a.localeCompare(b) : b.localeCompare(a);
            }

            if (sortConfig.key === 'usage') {
                const usageA = currencyUsage[a] || 0;
                const usageB = currencyUsage[b] || 0;
                return sortConfig.direction === 'asc' ? usageA - usageB : usageB - usageA;
            }

            // Default sorting logic (if no manual sort key)
            // 1. Main currency always on top
            if (a === settings?.main_currency) return -1;
            if (b === settings?.main_currency) return 1;

            // 2. Secondary currencies sorted by their order
            const aIndex = settings?.secondary_currencies?.indexOf(a) ?? -1;
            const bIndex = settings?.secondary_currencies?.indexOf(b) ?? -1;

            if (aIndex !== -1 && bIndex !== -1) return aIndex - bIndex;
            if (aIndex !== -1) return -1;
            if (bIndex !== -1) return 1;

            // 3. Alphabetical for the rest
            return a.localeCompare(b);
        });

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="text-muted-foreground">Loading currencies...</div>
            </div>
        );
    }

    return (
        <div className="space-y-8 animate-fade-in">
            {/* Header */}
            <div className="space-y-2">
                <div className="flex items-center gap-2">
                    <Coins className="h-6 w-6 text-primary" />
                    <h1 className="text-4xl font-bold bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text">Currencies</h1>
                </div>
                <p className="text-muted-foreground text-lg">
                    Manage supported currencies and dashboard display preferences.
                    <span className="block text-sm text-yellow-600/80 mt-1 font-medium">
                        Note: You can select up to 4 additional currencies. They will be displayed in the order selected (1-4).
                    </span>
                </p>
            </div>

            {/* Content */}
            <div className="space-y-4">
                {/* Search & Actions */}
                <div className="flex gap-4 items-center">
                    <div className="relative flex-1 group">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground group-focus-within:text-primary transition-colors" />
                        <input
                            type="text"
                            placeholder="Search currencies..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-12 pr-10 py-3 glass-strong rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all"
                        />
                        {searchQuery && (
                            <button
                                onClick={() => setSearchQuery('')}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors p-1"
                            >
                                <X className="h-4 w-4" />
                            </button>
                        )}
                    </div>
                    <Button
                        onClick={() => setShowAddModal(true)}
                        variant="premium"
                        className="group shrink-0"
                    >
                        <Plus className="h-5 w-5 mr-2 group-hover:rotate-90 transition-transform duration-300" />
                        Add
                    </Button>
                </div>

                {/* Table */}
                <div className="glass-strong rounded-xl border border-border/50 overflow-x-auto">
                    <table className="w-full">
                        <thead className="bg-gradient-to-r from-primary/5 to-accent/5 backdrop-blur-sm rounded-t-xl">
                            <tr className="text-left text-sm font-medium text-muted-foreground">
                                <th
                                    className="px-6 py-4 cursor-pointer hover:text-foreground transition-colors group"
                                    onClick={() => handleSort('code')}
                                >
                                    <div className="flex items-center gap-2">
                                        Currency Code
                                        <ArrowUpDown className={cn("h-4 w-4 transition-opacity", sortConfig.key === 'code' ? "opacity-100" : "opacity-0 group-hover:opacity-50")} />
                                    </div>
                                </th>
                                <th className="px-6 py-4 text-left">Exchange Rate</th>

                                {/* Trend Columns */}
                                <th className="px-4 py-4 text-center">1D</th>
                                <th className="px-4 py-4 text-center">1W</th>
                                <th className="px-4 py-4 text-center">1M</th>
                                <th className="px-4 py-4 text-center">1Y</th>

                                <th className="px-6 py-4 text-center">Main Currency</th>
                                <th className="px-6 py-4 text-center">Dashboard Display</th>
                                <th className="px-6 py-4 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border/50">
                            {filteredCurrencies.map((code) => {
                                const isMain = code === settings?.main_currency;
                                const isSecondary = settings?.secondary_currencies?.includes(code);
                                const rate = marketRates?.rates?.[code];
                                const trends = trendData?.trends?.[code];

                                return (
                                    <tr key={code} className="group hover:bg-primary/5 transition-all duration-200">
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center font-bold text-primary text-sm">
                                                    {getCurrencySymbol(code) || '?'}
                                                </div>
                                                <div className="flex flex-col">
                                                    <span className="font-semibold text-lg leading-none flex items-center gap-2">
                                                        {code}
                                                        {!(settings?.currencies || []).includes(code) && (
                                                            <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-yellow-500/10 text-yellow-500 border border-yellow-500/20">
                                                                Unmanaged
                                                            </span>
                                                        )}
                                                    </span>
                                                    {!isValidCurrency(code) && (
                                                        <span className="text-[10px] text-destructive flex items-center gap-1 mt-1 font-medium">
                                                            <AlertCircle className="w-3 h-3" /> Invalid Code
                                                        </span>
                                                    )}
                                                    {currencyUsage[code] > 0 && (
                                                        <span className="text-[10px] text-muted-foreground mt-0.5">
                                                            Used by {currencyUsage[code]} asset{currencyUsage[code] !== 1 ? 's' : ''}
                                                        </span>
                                                    )}
                                                    {KNOWN_CRYPTO.has(code) && (
                                                        <span className="text-[10px] text-amber-500 flex items-center gap-1 mt-0.5 font-medium bg-amber-500/10 px-1 rounded w-fit">
                                                            <Bitcoin className="w-3 h-3" /> Crypto
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            {rate ? (
                                                <div className="flex flex-col">
                                                    <span className="font-medium">
                                                        {formatCurrency(rate, settings.main_currency || 'USD', 6, settings.number_format)}
                                                    </span>
                                                    <span className="text-[10px] text-muted-foreground mt-0.5">
                                                        {marketRates?.last_updated ? (() => {
                                                            const lastUpdate = new Date(marketRates.last_updated);
                                                            const now = new Date();
                                                            const diffMinutes = (now.getTime() - lastUpdate.getTime()) / 1000 / 60;
                                                            const isStale = diffMinutes > 20;

                                                            return (
                                                                <span
                                                                    title={`${formatDateTime(marketRates.last_updated)} (${currentTimezone})`}
                                                                    className={cn(
                                                                        "transition-colors",
                                                                        isStale ? "text-amber-500/80" : "text-emerald-500/80"
                                                                    )}
                                                                >
                                                                    {isStale ? "⚠ " : "● "}
                                                                    updated {formatTime(marketRates.last_updated)}
                                                                </span>
                                                            );
                                                        })() : (
                                                            <span>1 {code}</span>
                                                        )}
                                                    </span>
                                                </div>
                                            ) : (
                                                <span className="text-muted-foreground text-sm">-</span>
                                            )}
                                        </td>



                                        {/* Trends */}
                                        {
                                            isMain ? (
                                                <>
                                                    <td className="px-4 py-4 text-center">
                                                        <div className="flex justify-center text-xs text-muted-foreground font-mono bg-muted/30 py-1 px-2 rounded">BASE</div>
                                                    </td>
                                                    <td className="px-4 py-4 text-center">
                                                        <div className="flex justify-center text-xs text-muted-foreground font-mono bg-muted/30 py-1 px-2 rounded">BASE</div>
                                                    </td>
                                                    <td className="px-4 py-4 text-center">
                                                        <div className="flex justify-center text-xs text-muted-foreground font-mono bg-muted/30 py-1 px-2 rounded">BASE</div>
                                                    </td>
                                                    <td className="px-4 py-4 text-center">
                                                        <div className="flex justify-center text-xs text-muted-foreground font-mono bg-muted/30 py-1 px-2 rounded">BASE</div>
                                                    </td>
                                                </>
                                            ) : (
                                                <>
                                                    <td className="px-4 py-4 text-center">
                                                        <div className="flex justify-center">
                                                            <TrendIndicator
                                                                value={trends?.['1d']}
                                                                onClick={() => setSelectedTrend({ currency: code, period: '1d' })}
                                                            />
                                                        </div>
                                                    </td>
                                                    <td className="px-4 py-4 text-center">
                                                        <div className="flex justify-center">
                                                            <TrendIndicator
                                                                value={trends?.['1w']}
                                                                onClick={() => setSelectedTrend({ currency: code, period: '1w' })}
                                                            />
                                                        </div>
                                                    </td>
                                                    <td className="px-4 py-4 text-center">
                                                        <div className="flex justify-center">
                                                            <TrendIndicator
                                                                value={trends?.['1m']}
                                                                onClick={() => setSelectedTrend({ currency: code, period: '1m' })}
                                                            />
                                                        </div>
                                                    </td>
                                                    <td className="px-4 py-4 text-center">
                                                        <div className="flex justify-center">
                                                            <TrendIndicator
                                                                value={trends?.['1y']}
                                                                onClick={() => setSelectedTrend({ currency: code, period: '1y' })}
                                                            />
                                                        </div>
                                                    </td>
                                                </>
                                            )
                                        }

                                        <td className="px-6 py-4 text-center">
                                            <button
                                                onClick={() => setMainCurrency(code)}
                                                className={cn(
                                                    "p-2 rounded-full transition-all duration-300",
                                                    isMain
                                                        ? "bg-yellow-400/20 text-yellow-500 scale-110"
                                                        : "text-muted-foreground hover:bg-muted hover:text-yellow-500/70"
                                                )}
                                                title={isMain ? "Current Main Currency" : "Set as Main Currency"}
                                            >
                                                <Star className={cn("h-5 w-5", isMain && "fill-current")} />
                                            </button>
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            <div className="flex items-center justify-center gap-2">
                                                <button
                                                    onClick={() => toggleSecondaryCurrency(code)}
                                                    disabled={isMain}
                                                    className={cn(
                                                        "p-2 rounded-full transition-all duration-300",
                                                        isMain ? "opacity-30 cursor-not-allowed text-muted-foreground" :
                                                            isSecondary
                                                                ? "bg-primary/20 text-primary scale-110"
                                                                : "text-muted-foreground hover:bg-muted hover:text-primary/70"
                                                    )}
                                                    title={isMain ? "Main currency is always displayed" : "Toggle Dashboard Display"}
                                                >
                                                    <Eye className="h-5 w-5" />
                                                </button>
                                                {isSecondary && (
                                                    <span className="flex items-center justify-center w-5 h-5 text-[10px] font-bold bg-primary text-primary-foreground rounded-full shadow-sm" title={`Display Order: ${(settings?.secondary_currencies?.indexOf(code) ?? -1) + 1} `}>
                                                        {(settings?.secondary_currencies?.indexOf(code) ?? -1) + 1}
                                                    </span>
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            {!isMain && (
                                                <div className="flex justify-end">
                                                    {!(settings?.currencies || []).includes(code) ? (
                                                        <button
                                                            onClick={(e) => {
                                                                e.preventDefault();
                                                                const currentList = settings?.currencies || [];
                                                                updateSettings({ currencies: [...currentList, code] });
                                                            }}
                                                            className="p-2 text-primary hover:bg-primary/10 rounded-lg transition-all"
                                                            title="Add to Managed Currencies"
                                                        >
                                                            <Plus className="h-5 w-5" />
                                                        </button>
                                                    ) : (
                                                        <button
                                                            onClick={(e) => handleDeleteCurrency(code, e)}
                                                            disabled={currencyUsage[code] > 0}
                                                            className={cn(
                                                                "p-2 rounded-lg transition-all",
                                                                currencyUsage[code] > 0
                                                                    ? "text-muted-foreground/30 cursor-not-allowed"
                                                                    : "text-muted-foreground hover:text-red-500 hover:bg-red-500/10"
                                                            )}
                                                            title={currencyUsage[code] > 0 ? `Cannot remove: Used by ${currencyUsage[code]} asset(s)` : "Remove Currency"}
                                                        >
                                                            <Trash2 className="h-5 w-5" />
                                                        </button>
                                                    )}
                                                </div>
                                            )}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div >

            {/* Add Modal */}
            <AddModal
                isOpen={showAddModal}
                onClose={handleCloseModal}
                title="Add Currency"
                hasUnsavedChanges={!!newCurrency}
                onSubmit={handleAddCurrency}
                submitLabel="Add Currency"
                isSubmitting={isUpdating}
            >
                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium mb-1.5">Currency Code</label>
                        <input
                            type="text"
                            value={newCurrency}
                            onChange={(e) => {
                                setNewCurrency(e.target.value.toUpperCase());
                                setAddError('');
                            }}
                            placeholder="e.g. JPY, BTC"
                            maxLength={4}
                            className="w-full px-4 py-2 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all font-mono uppercase"
                            autoFocus
                        />
                        <p className="text-xs text-muted-foreground mt-1">
                            ISO 4217 3-letter code (e.g. USD, EUR, GBP)
                        </p>
                    </div>

                    {addError && (
                        <div className="text-sm text-destructive bg-destructive/10 p-3 rounded-lg">
                            {addError}
                        </div>
                    )}
                </div>
            </AddModal>

            {isDeleteModalOpen && currencyToEdit && (
                <DeleteConfirmModal
                    isOpen={true}
                    onClose={() => {
                        setIsDeleteModalOpen(false);
                        setCurrencyToEdit(null);
                    }}
                    onConfirm={() => {
                        const currentList = settings.currencies || [];
                        const currentSecondary = settings.secondary_currencies || [];
                        updateSettings({
                            currencies: currentList.filter(c => c !== currencyToEdit),
                            secondary_currencies: currentSecondary.filter(c => c !== currencyToEdit)
                        });
                        setIsDeleteModalOpen(false);
                        setCurrencyToEdit(null);
                    }}
                    title="Currency"
                    itemName={currencyToEdit}
                    confirmLabel="Remove"
                    warning="Historical data for this currency will remain in the database, but it will no longer be available for selection."
                />
            )}

            {/* Trend History Modal */}
            {selectedTrend && (
                <Modal
                    isOpen={!!selectedTrend}
                    onClose={() => setSelectedTrend(null)}
                    className="max-w-3xl h-[500px]"
                    title={
                        (() => {
                            const code = selectedTrend.currency;
                            const period = selectedTrend.period;
                            const rate = marketRates?.rates?.[code];
                            const trendPct = trendData?.trends?.[code]?.[period] ?? 0;
                            const isPositive = trendPct >= 0;

                            // Calculate absolute change approx
                            // This is an approximation if we assume trendPct is vs current rate
                            // Actually trend is usually (Current - Open) / Open
                            // So Open = Current / (1 + pct/100)
                            // Change = Current - Open
                            let changeVal = 0;
                            if (rate && trendPct != null) {
                                const open = rate / (1 + trendPct / 100);
                                changeVal = rate - open;
                            }

                            return (
                                <div className="flex items-center w-full gap-6">
                                    <div className="flex flex-col">
                                        <span className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">Price</span>
                                        <div className="flex items-baseline gap-3">
                                            <span className="text-4xl font-extrabold tracking-tight text-foreground">
                                                {rate ? formatCurrency(rate, settings.main_currency || 'USD', 2, settings.number_format) : '---'}
                                            </span>
                                        </div>
                                        <div className={cn("flex items-center gap-2 text-sm font-medium mt-1", isPositive ? "text-emerald-400" : "text-red-500")}>
                                            <span className="flex items-center">
                                                {isPositive ? '▲' : '▼'} {Math.abs(trendPct).toFixed(2)}%
                                            </span>
                                            <span className="text-muted-foreground opacity-60 font-normal">
                                                ({changeVal >= 0 ? '+' : ''}{formatCurrency(changeVal, settings.main_currency || 'USD', 2, settings.number_format)})
                                            </span>
                                        </div>
                                    </div>

                                    <div className="flex-1" /> {/* Spacer */}

                                    <div className="flex items-center bg-black/20 p-1 rounded-lg border border-white/10 self-center">
                                        {['1d', '1w', '1m', '3m', '1y', 'all'].map((tf) => (
                                            <button
                                                key={tf}
                                                onClick={() => setSelectedTrend({ ...selectedTrend, period: tf })}
                                                className={cn(
                                                    "px-3 py-1 text-[11px] font-bold uppercase rounded-md transition-all",
                                                    selectedTrend.period === tf
                                                        ? "bg-white/10 text-white shadow-sm border border-white/5"
                                                        : "text-muted-foreground hover:text-white hover:bg-white/5"
                                                )}
                                            >
                                                {tf}
                                            </button>
                                        ))}
                                    </div>
                                    <div className="w-8" />
                                </div>
                            );
                        })()
                    }
                >
                    <div className="w-full h-full min-h-0">
                        <CurrencyHistoryChart
                            currency={selectedTrend.currency}
                            mainCurrency={settings?.main_currency || 'USD'}
                            timeRange={selectedTrend.period}
                            className="w-full h-full"
                        />
                    </div>
                </Modal>
            )}
        </div >
    );
}
