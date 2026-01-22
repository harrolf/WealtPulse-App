import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Building2, Plus, Trash2, ExternalLink, Search, Globe, ArrowUpDown, X } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { DeleteConfirmModal } from '@/components/ui/DeleteConfirmModal';
import { AddCustodianForm } from '@/components/forms/AddCustodianForm';
import { EditCustodianForm } from '@/components/forms/EditCustodianForm';
import { cn, getFaviconUrl } from '@/lib/utils';
import { CustodiansService } from '@/services/custodians';
import type { Custodian } from '@/services/custodians';
import { AssetsService } from '@/services/assets';
import type { Asset } from '@/services/assets';

interface SortConfig {
    key: 'name' | 'type' | 'website_url' | null;
    direction: 'asc' | 'desc';
}

export function Custodians() {
    const [searchQuery, setSearchQuery] = useState('');
    const [showAddCustodian, setShowAddCustodian] = useState(false);
    const [editingCustodian, setEditingCustodian] = useState<Custodian | null>(null);
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [sortConfig, setSortConfig] = useState<SortConfig>({ key: 'name', direction: 'asc' });
    const queryClient = useQueryClient();

    const { data: custodians = [], isLoading: isLoadingCustodians } = useQuery({
        queryKey: ['custodians'],
        queryFn: CustodiansService.getAll,
    });

    const { data: assets = [], isLoading: isLoadingAssets } = useQuery<Asset[]>({
        queryKey: ['assets'],
        queryFn: AssetsService.getAll,
    });

    // Calculate custodian usage
    const custodianUsage = (assets || []).reduce((acc, asset) => {
        if (asset.custodian_id) {
            acc[asset.custodian_id] = (acc[asset.custodian_id] || 0) + 1;
        }
        return acc;
    }, {} as Record<number, number>);

    const isLoading = isLoadingCustodians || isLoadingAssets;

    const deleteCustodianMutation = useMutation({
        mutationFn: CustodiansService.delete,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['custodians'] });
            queryClient.invalidateQueries({ queryKey: ['portfolio-allocation'] });
        }
    });

    const handleDeleteCustodian = (id: number, e: React.MouseEvent, custodian: Custodian) => {
        e.preventDefault();
        e.stopPropagation();

        if (custodianUsage[id] > 0) {
            return;
        }

        setEditingCustodian(custodian);
        setIsDeleteModalOpen(true);
    };

    const handleEdit = (custodian: Custodian) => {
        setEditingCustodian(custodian);
    };

    const handleCloseForm = () => {
        setShowAddCustodian(false);
        setEditingCustodian(null);
        setIsDeleteModalOpen(false);
    };

    const handleSort = (key: SortConfig['key']) => {
        setSortConfig(current => ({
            key,
            direction: current.key === key && current.direction === 'asc' ? 'desc' : 'asc',
        }));
    };

    const filteredCustodians = custodians
        .filter((custodian: Custodian) => {
            const query = searchQuery.toLowerCase();
            return (
                custodian.name.toLowerCase().includes(query) ||
                custodian.type.toLowerCase().includes(query) ||
                (custodian.website_url && custodian.website_url.toLowerCase().includes(query))
            );
        })
        .sort((a, b) => {
            if (!sortConfig.key) return 0;

            const aValue = a[sortConfig.key] || '';
            const bValue = b[sortConfig.key] || '';

            if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
            if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
            return 0;
        });

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="text-muted-foreground">Loading custodians...</div>
            </div>
        );
    }

    return (
        <div className="space-y-8 animate-fade-in">
            {/* Header */}
            <div className="space-y-2">
                <div className="flex items-center gap-2">
                    <Building2 className="h-6 w-6 text-primary" />
                    <h1 className="text-4xl font-bold bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text">Custodians</h1>
                </div>
                <p className="text-muted-foreground text-lg">
                    Manage banks, brokers, wallets, and physical storage locations.
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
                            placeholder="Search custodians..."
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
                        onClick={() => setShowAddCustodian(true)}
                        variant="premium"
                        className="group shrink-0"
                    >
                        <Plus className="h-5 w-5 mr-2 group-hover:rotate-90 transition-transform duration-300" />
                        Add
                    </Button>
                </div>

                {filteredCustodians.length === 0 ? (
                    <div className="text-center py-12 bg-card rounded-xl border border-border">
                        <p className="text-muted-foreground">
                            {searchQuery ? 'No custodians match your search.' : 'No custodians yet. Add your first custodian to get started.'}
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
                                            className="px-6 py-4 cursor-pointer hover:text-foreground transition-colors group"
                                            onClick={() => handleSort('name')}
                                        >
                                            <div className="flex items-center gap-2">
                                                Custodian
                                                <ArrowUpDown className={cn("h-4 w-4 transition-opacity", sortConfig.key === 'name' ? "opacity-100" : "opacity-0 group-hover:opacity-50")} />
                                            </div>
                                        </th>
                                        <th
                                            className="px-6 py-4 cursor-pointer hover:text-foreground transition-colors group"
                                            onClick={() => handleSort('type')}
                                        >
                                            <div className="flex items-center gap-2">
                                                Type
                                                <ArrowUpDown className={cn("h-4 w-4 transition-opacity", sortConfig.key === 'type' ? "opacity-100" : "opacity-0 group-hover:opacity-50")} />
                                            </div>
                                        </th>
                                        <th
                                            className="px-6 py-4 text-center cursor-pointer hover:text-foreground transition-colors group"
                                            onClick={() => handleSort('website_url')}
                                        >
                                            <div className="flex items-center justify-center gap-2">
                                                Website
                                                <ArrowUpDown className={cn("h-4 w-4 transition-opacity", sortConfig.key === 'website_url' ? "opacity-100" : "opacity-0 group-hover:opacity-50")} />
                                            </div>
                                        </th>
                                        <th className="px-6 py-4 text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-border/50">
                                    {filteredCustodians.map((custodian: Custodian) => {
                                        const favicon = getFaviconUrl(custodian.website_url || '');

                                        return (
                                            <tr
                                                key={custodian.id}
                                                className="group hover:bg-primary/5 transition-all duration-200"
                                            >
                                                <td className="px-6 py-4 cursor-pointer" onClick={() => handleEdit(custodian)}>
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0 overflow-hidden">
                                                            {favicon ? (
                                                                <img
                                                                    src={favicon}
                                                                    alt={custodian.name}
                                                                    className="w-6 h-6 object-contain opacity-90 group-hover:opacity-100 group-hover:scale-110 transition-all"
                                                                    onError={(e) => {
                                                                        e.currentTarget.style.display = 'none';
                                                                        e.currentTarget.parentElement!.querySelector('.fallback-icon')!.classList.remove('hidden');
                                                                    }}
                                                                />
                                                            ) : null}
                                                            <Building2 className={cn("h-5 w-5 text-primary fallback-icon", favicon && "hidden")} />
                                                        </div>
                                                        <div className="flex flex-col">
                                                            <span className="font-semibold text-lg">{custodian.name}</span>
                                                            {custodianUsage[custodian.id] > 0 && (
                                                                <span className="text-xs text-muted-foreground">
                                                                    Used by {custodianUsage[custodian.id]} asset{custodianUsage[custodian.id] !== 1 ? 's' : ''}
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 cursor-pointer" onClick={() => handleEdit(custodian)}>
                                                    <span className="px-3 py-1 bg-muted/50 rounded-full text-sm font-medium border border-border/50">
                                                        {custodian.type}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4 text-center">
                                                    {custodian.website_url ? (
                                                        <a
                                                            href={custodian.website_url.startsWith('http') ? custodian.website_url : `https://${custodian.website_url}`}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            onClick={(e) => e.stopPropagation()}
                                                            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-primary transition-colors py-1 px-3 hover:bg-primary/5 rounded-full"
                                                        >
                                                            <Globe className="h-4 w-4" />
                                                            <span className="hidden lg:inline">Visit</span>
                                                            <ExternalLink className="h-3 w-3" />
                                                        </a>
                                                    ) : (
                                                        <span className="text-muted-foreground/30">-</span>
                                                    )}
                                                </td>
                                                <td className="px-6 py-4 text-right">
                                                    <div className="flex items-center justify-end gap-2 relative z-10">
                                                        <button
                                                            onClick={(e) => handleDeleteCustodian(custodian.id, e, custodian)} disabled={custodianUsage[custodian.id] > 0}
                                                            className={cn(
                                                                "p-2 rounded-lg transition-all",
                                                                custodianUsage[custodian.id] > 0
                                                                    ? "text-muted-foreground/30 cursor-not-allowed"
                                                                    : "text-muted-foreground hover:text-red-500 hover:bg-red-500/10"
                                                            )}
                                                            title={custodianUsage[custodian.id] > 0 ? "Cannot delete: assigned to assets" : "Delete"}
                                                        >
                                                            <Trash2 className="h-5 w-5" />
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
                            {filteredCustodians.map((custodian: Custodian) => {
                                const favicon = getFaviconUrl(custodian.website_url || '');

                                return (
                                    <div
                                        key={custodian.id}
                                        onClick={() => handleEdit(custodian)}
                                        className="glass-strong rounded-xl p-5 border border-border/50 hover:border-primary/30 transition-all duration-300 cursor-pointer"
                                    >
                                        <div className="cursor-pointer" onClick={() => handleEdit(custodian)}>
                                            <div className="cursor-pointer" onClick={() => handleEdit(custodian)}>
                                                <div className="flex items-start justify-between mb-4">
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0 overflow-hidden">
                                                            {favicon ? (
                                                                <img
                                                                    src={favicon}
                                                                    alt={custodian.name}
                                                                    className="w-7 h-7 object-contain opacity-90"
                                                                    onError={(e) => {
                                                                        e.currentTarget.style.display = 'none';
                                                                        e.currentTarget.parentElement!.querySelector('.fallback-icon')!.classList.remove('hidden');
                                                                    }}
                                                                />
                                                            ) : null}
                                                            <Building2 className={cn("h-6 w-6 text-primary fallback-icon", favicon && "hidden")} />
                                                        </div>
                                                        <div>
                                                            <h3 className="font-semibold text-lg">{custodian.name}</h3>
                                                            <span className="text-xs px-2 py-0.5 bg-muted/50 rounded-full border border-border/50">
                                                                {custodian.type}
                                                            </span>
                                                        </div>
                                                    </div>
                                                    <button
                                                        onClick={(e) => handleDeleteCustodian(custodian.id, e, custodian)} disabled={custodianUsage[custodian.id] > 0}
                                                        className={cn(
                                                            "p-2 -mr-2 transition-colors",
                                                            custodianUsage[custodian.id] > 0
                                                                ? "text-muted-foreground/30 cursor-not-allowed"
                                                                : "text-muted-foreground hover:text-red-500"
                                                        )}
                                                        title={custodianUsage[custodian.id] > 0 ? "Cannot delete: assigned to assets" : "Delete"}
                                                    >
                                                        <Trash2 className="h-5 w-5" />
                                                    </button>
                                                </div>

                                            </div>
                                        </div>
                                        {custodian.website_url && (
                                            <div className="flex items-center gap-2 pt-3 border-t border-border/30">
                                                <a
                                                    href={custodian.website_url.startsWith('http') ? custodian.website_url : `https://${custodian.website_url}`}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    onClick={(e) => e.stopPropagation()}
                                                    className="text-sm flex items-center gap-2 text-primary hover:underline"
                                                >
                                                    <Globe className="h-4 w-4" />
                                                    {custodian.website_url.replace(/^https?:\/\//, '').replace(/\/$/, '')}
                                                </a>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </>
                )}
            </div>

            {/* Add/Edit Modal */}
            {/* Note: showAddCustodian is confusingly named, it effectively means "show form modal" 
                but we use editingCustodian to distinguish add vs edit mode */}
            {(showAddCustodian || editingCustodian) && !isDeleteModalOpen && (
                editingCustodian ? (
                    <EditCustodianForm
                        custodian={editingCustodian}
                        onClose={handleCloseForm}
                        onSuccess={() => {
                            queryClient.invalidateQueries({ queryKey: ['custodians'] });
                            handleCloseForm();
                        }}
                        onDelete={() => setIsDeleteModalOpen(true)}
                        deleteDisabled={custodianUsage[editingCustodian.id] > 0}
                        deleteDisabledTooltip={custodianUsage[editingCustodian.id] > 0 ? `Cannot delete: assigned to ${custodianUsage[editingCustodian.id]} asset(s)` : undefined}
                    />
                ) : (
                    <AddCustodianForm
                        onClose={handleCloseForm}
                        onSuccess={() => {
                            queryClient.invalidateQueries({ queryKey: ['custodians'] });
                            handleCloseForm();
                        }}
                    />
                )
            )}

            {isDeleteModalOpen && editingCustodian && (
                <DeleteConfirmModal
                    isOpen={true}
                    onClose={() => {
                        setIsDeleteModalOpen(false);
                        if (!showAddCustodian) setEditingCustodian(null);
                    }}
                    onConfirm={() => {
                        deleteCustodianMutation.mutate(editingCustodian.id);
                        setIsDeleteModalOpen(false);
                        setEditingCustodian(null);
                        setShowAddCustodian(false);
                    }}
                    title="Custodian"
                    itemName={editingCustodian.name}
                    isDeleting={deleteCustodianMutation.isPending}
                    warning="Deleting a custodian will remove it from all associated assets. This action cannot be undone."
                />
            )}
        </div>
    );
}
