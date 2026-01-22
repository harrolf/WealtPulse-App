import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import axios from 'axios';
import { DeleteConfirmModal } from '@/components/ui/DeleteConfirmModal';
import {
    Plus, Search, Star, ArrowUpDown, Building2, Trash2,
    TrendingUp, Layers, FileText, PieChart, Bitcoin, DollarSign, Briefcase,
    Home, Truck, Anchor, Image, Box, Droplet, Activity, CreditCard, Wallet, X, Upload
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { AssetsService } from '@/services/assets';
import type { Asset, AssetUpdate } from '@/services/assets';
import { AssetTypesService } from '@/services/assetTypes';
import { CustodiansService } from '@/services/custodians';
import type { Custodian } from '@/services/custodians';
import { GroupsService } from '@/services/groups';
import { TagsService } from '@/services/tags';
import type { AssetType } from '@/services/assetTypes';
import { cn, getFaviconUrl, formatCurrency } from '@/lib/utils';
import { AddAssetForm } from '@/components/forms/AddAssetForm';
import { EditAssetForm } from '@/components/forms/EditAssetForm';
import { RevalueAssetModal } from '@/components/modals/RevalueAssetModal';
import { BrokerImportModal } from '@/components/integrations/BrokerImportModal';
import { useSettingsContext } from '@/contexts/SettingsContext';
import { toast } from '@/services/toast';

interface SortConfig {
    key: 'name' | 'type' | 'value_orig' | 'value_curr' | 'value_main' | 'is_favorite' | 'custodian' | null;
    direction: 'asc' | 'desc';
}

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
    'trending-up': TrendingUp,
    'layers': Layers,
    'file-text': FileText,
    'pie-chart': PieChart,
    'bitcoin': Bitcoin,
    'dollar-sign': DollarSign,
    'briefcase': Briefcase,
    'home': Home,
    'truck': Truck,
    'anchor': Anchor,
    'image': Image,
    'box': Box,
    'droplet': Droplet,
    'activity': Activity,
    'credit-card': CreditCard,
};

export function Assets() {
    const queryClient = useQueryClient();
    const { settings } = useSettingsContext();
    const [searchQuery, setSearchQuery] = useState('');
    const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
    const [showAddForm, setShowAddForm] = useState(false);
    const [showEToroImport, setShowEToroImport] = useState(false);
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [editingAsset, setEditingAsset] = useState<Asset | null>(null);
    const [revaluingAsset, setRevaluingAsset] = useState<Asset | null>(null);
    const [sortConfig, setSortConfig] = useState<SortConfig>({ key: null, direction: 'asc' });

    // Fetch Assets
    const { data: assets = [], isLoading: isLoadingAssets } = useQuery({
        queryKey: ['assets'],
        queryFn: AssetsService.getAll,
    });

    // Fetch Asset Types for icons
    const { data: assetTypes = [] } = useQuery({
        queryKey: ['asset-types'],
        queryFn: AssetTypesService.getAll,
    });

    // Fetch Custodians
    const { data: custodians = [] } = useQuery({
        queryKey: ['custodians'],
        queryFn: CustodiansService.getAll,
    });

    // Fetch Primary Groups
    const { data: groups = [] } = useQuery({
        queryKey: ['primary-groups'],
        queryFn: GroupsService.getAll,
    });

    // Fetch Tags
    const { data: tags = [] } = useQuery({
        queryKey: ['tags'],
        queryFn: TagsService.getAll,
    });

    const mainCurrency = settings?.main_currency || 'CHF';

    const toggleFavoriteMutation = useMutation({
        mutationFn: async (asset: Asset) => {
            // We only want to flip is_favorite.
            const payload: AssetUpdate = {
                is_favorite: !asset.is_favorite
            };
            return AssetsService.update(asset.id, payload);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['assets'] });
            queryClient.invalidateQueries({ queryKey: ['portfolio-summary'] });
        },
    });

    const deleteAssetMutation = useMutation({
        mutationFn: AssetsService.delete,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['assets'] });
            queryClient.invalidateQueries({ queryKey: ['portfolio-summary'] });
            setIsDeleteModalOpen(false);
            setEditingAsset(null);
        },
        onError: (error) => {
            let message = "Failed to delete asset";
            if (axios.isAxiosError(error)) {
                message = error.response?.data?.detail || message;
            }
            toast.error(message);
        }
    });



    const handleDelete = (e: React.MouseEvent, asset: Asset) => {
        e.preventDefault();
        e.stopPropagation();

        setEditingAsset(asset);
        setIsDeleteModalOpen(true);
    };

    const handleSort = (key: SortConfig['key']) => {
        setSortConfig(current => ({
            key,
            direction: current.key === key && current.direction === 'asc' ? 'desc' : 'asc',
        }));
    };

    const getAssetValue = (asset: Asset) => {
        const effectiveQuantity = asset.quantity === 0 ? 1 : asset.quantity;
        // Prioritize current_price if available, fallback to purchase_price
        const price = asset.current_price ?? asset.purchase_price ?? 0;
        return effectiveQuantity * price;
    };

    const filteredAndSortedAssets = assets
        .filter(asset => {
            const query = searchQuery.toLowerCase();
            const typeName = assetTypes.find(t => t.id === asset.asset_type_id)?.name.toLowerCase() || '';
            const custodianName = custodians.find(c => c.id === asset.custodian_id)?.name.toLowerCase() || '';

            const matchesSearch = (
                asset.name.toLowerCase().includes(query) ||
                asset.ticker_symbol?.toLowerCase().includes(query) ||
                typeName.includes(query) ||
                custodianName.includes(query)
            );
            const matchesFavorite = !showFavoritesOnly || asset.is_favorite;

            return matchesSearch && matchesFavorite;
        })
        .sort((a, b) => {
            if (!sortConfig.key) return 0;

            let aValue: string | number;
            let bValue: string | number;

            if (sortConfig.key === 'value_orig') {
                const qtyA = a.quantity === 0 ? 1 : a.quantity;
                const qtyB = b.quantity === 0 ? 1 : b.quantity;
                aValue = qtyA * (a.purchase_price ?? 0);
                bValue = qtyB * (b.purchase_price ?? 0);
            } else if (sortConfig.key === 'value_curr') {
                const qtyA = a.quantity === 0 ? 1 : a.quantity;
                const qtyB = b.quantity === 0 ? 1 : b.quantity;
                // Use current price if available, else purchase price
                aValue = qtyA * (a.current_price ?? a.purchase_price ?? 0);
                bValue = qtyB * (b.current_price ?? b.purchase_price ?? 0);
            } else if (sortConfig.key === 'type') {
                const typeA = assetTypes.find(t => t.id === a.asset_type_id)?.name || '';
                const typeB = assetTypes.find(t => t.id === b.asset_type_id)?.name || '';
                aValue = typeA;
                bValue = typeB;
            } else if (sortConfig.key === 'custodian') {
                const custA = custodians.find(c => c.id === a.custodian_id)?.name || '';
                const custB = custodians.find(c => c.id === b.custodian_id)?.name || '';
                aValue = custA;
                bValue = custB;
            } else if (sortConfig.key === 'value_main') {
                aValue = a.value_in_main_currency || 0;
                bValue = b.value_in_main_currency || 0;
            } else {
                aValue = a[sortConfig.key as keyof Asset] as string | number;
                bValue = b[sortConfig.key as keyof Asset] as string | number;
            }

            if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
            if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
            return 0;
        });

    const handleEdit = (asset: Asset) => {
        setEditingAsset(asset);
        setShowAddForm(true);
    };

    const handleRevalue = (asset: Asset, e: React.MouseEvent) => {
        e.stopPropagation();
        setRevaluingAsset(asset);
    };

    const handleCloseForm = () => {
        setShowAddForm(false);
        setEditingAsset(null);
    };

    if (isLoadingAssets) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="text-muted-foreground">Loading assets...</div>
            </div>
        );
    }

    return (
        <div className="space-y-8 animate-fade-in" >
            {/* Header */}
            <div className="space-y-2">
                <div className="flex items-center gap-2">
                    <Wallet className="h-6 w-6 text-primary" />
                    <h1 className="text-4xl font-bold bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text">Assets</h1>
                </div>
                <p className="text-muted-foreground text-lg">
                    Manage your portfolio holdings
                </p>
            </div>

            {/* Filters */}
            <div className="flex flex-col md:flex-row gap-4 items-center">
                <div className="flex-1 w-full relative group">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground group-focus-within:text-primary transition-colors" />
                    <input
                        type="text"
                        placeholder="Search assets..."
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
                <div className="flex gap-3 w-full md:w-auto">
                    <Button
                        onClick={() => setShowFavoritesOnly(!showFavoritesOnly)}
                        variant={showFavoritesOnly ? "default" : "glass"}
                        className={cn(
                            "flex-1 md:flex-none",
                            showFavoritesOnly && "shadow-lg shadow-primary/25 border-transparent"
                        )}
                    >
                        <Star className={cn("h-5 w-5 mr-2 transition-transform", showFavoritesOnly && "fill-current scale-110")} />
                        Favorites
                    </Button>
                    <Button
                        onClick={() => setShowEToroImport(true)}
                        variant="glass"
                        className="flex-1 md:flex-none"
                        title="Import from eToro"
                    >
                        <Upload className="h-5 w-5 mr-2" />
                        Import
                    </Button>
                    <Button
                        onClick={() => setShowAddForm(true)}
                        variant="premium"
                        className="group flex-1 md:flex-none"
                    >
                        <Plus className="h-5 w-5 mr-2 group-hover:rotate-90 transition-transform duration-300" />
                        Add
                    </Button>
                </div>
            </div>

            {/* Assets Table/Cards */}
            {
                filteredAndSortedAssets.length === 0 ? (
                    <div className="text-center py-12 bg-card rounded-xl border border-border">
                        <p className="text-muted-foreground">
                            {searchQuery || showFavoritesOnly ? 'No assets match your filters' : 'No assets yet. Add your first asset to get started.'}
                        </p>
                    </div>
                ) : (
                    <>
                        {/* Desktop Table */}
                        <div className="hidden md:block glass-strong rounded-xl overflow-hidden border border-border/50">
                            <table className="w-full">
                                <thead className="bg-gradient-to-r from-primary/5 to-accent/5 backdrop-blur-sm">
                                    <tr className="text-left text-sm font-medium text-muted-foreground">
                                        <th
                                            className="px-6 py-4 text-center cursor-pointer hover:text-foreground transition-colors group"
                                            onClick={() => handleSort('type')}
                                        >
                                            <div className="flex items-center justify-center gap-2">
                                                Type
                                                <ArrowUpDown className={cn("h-4 w-4 transition-opacity", sortConfig.key === 'type' ? "opacity-100" : "opacity-0 group-hover:opacity-50")} />
                                            </div>
                                        </th>
                                        <th
                                            className="px-6 py-4 cursor-pointer hover:text-foreground transition-colors group"
                                            onClick={() => handleSort('name')}
                                        >
                                            <div className="flex items-center gap-2">
                                                Asset
                                                <ArrowUpDown className={cn("h-4 w-4 transition-opacity", sortConfig.key === 'name' ? "opacity-100" : "opacity-0 group-hover:opacity-50")} />
                                            </div>
                                        </th>
                                        <th
                                            className="px-6 py-4 cursor-pointer hover:text-foreground transition-colors group"
                                            onClick={() => handleSort('custodian')}
                                        >
                                            <div className="flex items-center gap-2">
                                                Custodian
                                                <ArrowUpDown className={cn("h-4 w-4 transition-opacity", sortConfig.key === 'custodian' ? "opacity-100" : "opacity-0 group-hover:opacity-50")} />
                                            </div>
                                        </th>
                                        <th
                                            className="px-6 py-4 text-right cursor-pointer hover:text-foreground transition-colors group"
                                            onClick={() => handleSort('value_orig')}
                                        >
                                            <div className="flex items-center justify-end gap-2">
                                                Value (Orig)
                                                <ArrowUpDown className={cn("h-4 w-4 transition-opacity", sortConfig.key === 'value_orig' ? "opacity-100" : "opacity-0 group-hover:opacity-50")} />
                                            </div>
                                        </th>
                                        <th
                                            className="px-6 py-4 text-right cursor-pointer hover:text-foreground transition-colors group"
                                            onClick={() => handleSort('value_curr')}
                                        >
                                            <div className="flex items-center justify-end gap-2">
                                                Value (Curr)
                                                <ArrowUpDown className={cn("h-4 w-4 transition-opacity", sortConfig.key === 'value_curr' ? "opacity-100" : "opacity-0 group-hover:opacity-50")} />
                                            </div>
                                        </th>
                                        <th
                                            className="px-6 py-4 text-right cursor-pointer hover:text-foreground transition-colors group"
                                            onClick={() => handleSort('value_main')}
                                        >
                                            <div className="flex items-center justify-end gap-2">
                                                Value ({mainCurrency})
                                                <ArrowUpDown className={cn("h-4 w-4 transition-opacity", sortConfig.key === 'value_main' ? "opacity-100" : "opacity-0 group-hover:opacity-50")} />
                                            </div>
                                        </th>

                                        <th className="px-6 py-4 text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-border/50">
                                    {filteredAndSortedAssets.map((asset) => {
                                        const effectiveQuantity = asset.quantity === 0 ? 1 : asset.quantity;
                                        const originalValue = effectiveQuantity * (asset.purchase_price ?? 0);
                                        const currentValue = effectiveQuantity * (asset.current_price ?? asset.purchase_price ?? 0);

                                        const assetType = assetTypes.find((t: AssetType) => t.id === asset.asset_type_id);
                                        const IconComponent = assetType?.icon ? iconMap[assetType.icon] : null;

                                        return (
                                            <tr
                                                key={asset.id}
                                                className="group hover:bg-primary/5 transition-all duration-200"
                                            >
                                                <td className="px-6 py-4 text-center cursor-pointer" onClick={() => handleEdit(asset)}>
                                                    {IconComponent && (
                                                        <span className="text-xl bg-muted/30 p-2 rounded-lg inline-flex items-center justify-center text-primary" title={assetType?.name}>
                                                            <IconComponent className="h-5 w-5" />
                                                        </span>
                                                    )}
                                                </td>
                                                <td className="px-6 py-4 cursor-pointer" onClick={() => handleEdit(asset)}>
                                                    <div className="flex items-center gap-3">
                                                        <div>
                                                            <div className="font-semibold group-hover:text-primary transition-colors">{asset.name}</div>
                                                            <div className="text-xs text-muted-foreground mt-0.5">{asset.ticker_symbol}</div>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 cursor-pointer" onClick={() => handleEdit(asset)}>
                                                    {custodians.find((c: Custodian) => c.id === asset.custodian_id) && (
                                                        <div className="flex items-center gap-2">
                                                            <div className="w-6 h-6 rounded-md bg-muted/30 flex items-center justify-center shrink-0 overflow-hidden">
                                                                {(() => {
                                                                    const custodian = custodians.find((c: Custodian) => c.id === asset.custodian_id);
                                                                    const favicon = custodian ? getFaviconUrl(custodian.website_url || '') : null;
                                                                    return favicon ? (
                                                                        <img src={favicon} alt={custodian?.name} className="w-4 h-4 object-contain" />
                                                                    ) : (
                                                                        <Building2 className="h-3 w-3 text-muted-foreground" />
                                                                    );
                                                                })()}
                                                            </div>
                                                            <span className="text-sm text-muted-foreground">
                                                                {custodians.find((c: Custodian) => c.id === asset.custodian_id)?.name}
                                                            </span>
                                                        </div>
                                                    )}
                                                </td>
                                                <td className="px-6 py-4 text-right text-muted-foreground cursor-pointer" onClick={() => handleEdit(asset)}>
                                                    {formatCurrency(originalValue, asset.currency, 2, settings.number_format)}
                                                </td>
                                                <td className="px-6 py-4 text-right font-medium cursor-pointer" onClick={() => handleEdit(asset)}>
                                                    {formatCurrency(currentValue, asset.currency, 2, settings.number_format)}
                                                </td>
                                                <td className="px-6 py-4 text-right font-semibold text-primary cursor-pointer" onClick={() => handleEdit(asset)}>
                                                    {formatCurrency(asset.value_in_main_currency || 0, mainCurrency, 2, settings.number_format)}
                                                </td>
                                                <td className="px-6 py-4 text-right">
                                                    <div className="flex items-center justify-end relative z-10">
                                                        {!asset.ticker_symbol && (
                                                            <button
                                                                onClick={(e) => handleRevalue(asset, e)}
                                                                className="p-1 hover:bg-muted rounded-full transition-colors mr-1"
                                                                title="Price History / Revalue"
                                                            >
                                                                <TrendingUp className="h-5 w-5 text-muted-foreground hover:text-primary transition-colors" />
                                                            </button>
                                                        )}
                                                        <button
                                                            onClick={(e) => {
                                                                e.preventDefault();
                                                                e.stopPropagation();
                                                                toggleFavoriteMutation.mutate(asset);
                                                            }}
                                                            className="p-1 hover:bg-muted rounded-full transition-colors"
                                                            title={asset.is_favorite ? "Remove from favorites" : "Add to favorites"}
                                                        >
                                                            <Star
                                                                className={cn(
                                                                    "h-5 w-5 transition-all duration-200",
                                                                    asset.is_favorite
                                                                        ? "fill-yellow-400 text-yellow-400 scale-110"
                                                                        : "text-muted-foreground hover:text-yellow-400 hover:scale-110"
                                                                )}
                                                            />
                                                        </button>
                                                        <button
                                                            onClick={(e) => handleDelete(e, asset)}
                                                            className="p-1 hover:bg-red-500/10 rounded-full transition-all group/delete"
                                                            title="Delete asset"
                                                        >
                                                            <Trash2 className="h-5 w-5 text-muted-foreground group-hover/delete:text-red-500 transition-colors" />
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>

                        {/* Mobile Cards */}
                        <div className="md:hidden space-y-4">
                            {filteredAndSortedAssets.map((asset, index) => {
                                const value = getAssetValue(asset);
                                const assetType = assetTypes.find((t: AssetType) => t.id === asset.asset_type_id);
                                const IconComponent = assetType?.icon ? iconMap[assetType.icon] : null;

                                return (
                                    <div
                                        key={asset.id}
                                        onClick={() => handleEdit(asset)}
                                        className="glass-strong rounded-xl p-5 border border-border/50 hover:border-primary/30 transition-all duration-300 animate-slide-up cursor-pointer"
                                        style={{ animationDelay: `${index * 0.05}s` }}
                                    >
                                        <div className="flex items-start justify-between mb-2">
                                            <div className="flex items-center gap-3">
                                                {IconComponent && (
                                                    <span className="text-2xl bg-muted/30 p-2 rounded-lg text-primary">
                                                        <IconComponent className="h-6 w-6" />
                                                    </span>
                                                )}
                                                <div>
                                                    <h3 className="font-semibold text-lg">{asset.name}</h3>
                                                    <div className="flex items-center gap-2 mt-1">
                                                        <p className="text-xs text-muted-foreground">{asset.ticker_symbol}</p>
                                                        {custodians.find((c: Custodian) => c.id === asset.custodian_id) && (
                                                            <>
                                                                <span className="text-xs text-border">•</span>
                                                                <div className="flex items-center gap-1.5">
                                                                    {(() => {
                                                                        const custodian = custodians.find((c: Custodian) => c.id === asset.custodian_id);
                                                                        const favicon = custodian ? getFaviconUrl(custodian.website_url || '') : null;
                                                                        return favicon ? (
                                                                            <img src={favicon} alt={custodian?.name} className="w-3 h-3 object-contain opacity-70" />
                                                                        ) : (
                                                                            <Building2 className="h-3 w-3 text-muted-foreground/70" />
                                                                        );
                                                                    })()}
                                                                    <span className="text-xs text-muted-foreground">
                                                                        {custodians.find((c: Custodian) => c.id === asset.custodian_id)?.name}
                                                                    </span>
                                                                </div>
                                                            </>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="flex flex-col gap-1 -mr-1">
                                                {!asset.ticker_symbol && (
                                                    <button
                                                        onClick={(e) => handleRevalue(asset, e)}
                                                        className="p-1 hover:bg-muted rounded-full transition-colors"
                                                        title="Price History"
                                                    >
                                                        <TrendingUp className="h-6 w-6 text-muted-foreground hover:text-primary" />
                                                    </button>
                                                )}
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        toggleFavoriteMutation.mutate(asset);
                                                    }}
                                                    className="p-1 hover:bg-muted rounded-full transition-colors"
                                                >
                                                    <Star
                                                        className={cn(
                                                            "h-6 w-6 transition-all duration-200",
                                                            asset.is_favorite
                                                                ? "fill-yellow-400 text-yellow-400 scale-110"
                                                                : "text-muted-foreground"
                                                        )}
                                                    />
                                                </button>
                                                <button
                                                    onClick={(e) => handleDelete(e, asset)}
                                                    className="p-1 hover:bg-destructive/10 rounded-full transition-colors group/delete"
                                                    title="Delete asset"
                                                >
                                                    <Trash2 className="h-5 w-5 text-muted-foreground hover:text-destructive transition-colors" />
                                                </button>
                                            </div>
                                        </div>
                                        <div className="mt-4 pt-4 border-t border-border/30 flex items-center justify-between">
                                            <p className="text-sm text-muted-foreground">Current Value</p>
                                            <p className="font-bold text-lg text-primary">
                                                {formatCurrency(value, asset.currency, 2, settings.number_format)}
                                            </p>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </>
                )
            }

            {/* Add/Edit Asset Modal */}
            {/* Add/Edit Asset Modal */}
            {showAddForm && (
                editingAsset ? (
                    <EditAssetForm
                        asset={editingAsset}
                        onClose={handleCloseForm}
                        onSuccess={handleCloseForm}
                        onDelete={() => setIsDeleteModalOpen(true)}
                        assetTypes={assetTypes}
                        custodians={custodians}
                        primaryGroups={groups}
                        tags={tags}
                    />
                ) : (
                    <AddAssetForm
                        onClose={handleCloseForm}
                        onSuccess={handleCloseForm}
                    />
                )
            )}

            {
                revaluingAsset && (
                    <RevalueAssetModal
                        assetId={revaluingAsset.id}
                        assetName={revaluingAsset.name}
                        currency={revaluingAsset.currency}
                        onClose={() => setRevaluingAsset(null)}
                    />
                )
            }
            {isDeleteModalOpen && editingAsset && (
                <DeleteConfirmModal
                    isOpen={true}
                    onClose={() => {
                        setIsDeleteModalOpen(false);
                        setEditingAsset(null);
                    }}
                    onConfirm={() => {
                        if (editingAsset) {
                            deleteAssetMutation.mutate(editingAsset.id);
                        }
                    }}
                    title="Asset"
                    itemName={editingAsset.name}
                    isDeleting={deleteAssetMutation.isPending}
                    warning="This will permanently remove the asset and all its transaction history. This action cannot be undone."
                />
            )}

            {/* Broker Import Modal */}
            <BrokerImportModal
                isOpen={showEToroImport}
                onClose={() => setShowEToroImport(false)}
            />
        </div >
    );
}
