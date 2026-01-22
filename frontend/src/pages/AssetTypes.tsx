import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { DeleteConfirmModal } from '@/components/ui/DeleteConfirmModal';
import { Button } from '@/components/ui/Button';
import { AddModal } from '@/components/ui/AddModal';
import { EditModal } from '@/components/ui/EditModal';
import {
    Layers,
    Search,
    Plus,
    X,
    AlertCircle,
    ArrowUpDown,
    Tag,
    Trash2,
    Info,
    FileText,
    Box,
    Briefcase,
    CreditCard,
    Home,
    PieChart,
    Truck,
    Activity,
    DollarSign,
    Bitcoin,
    Anchor,
    Image,
    Droplet,
    TrendingUp
} from 'lucide-react';
import { AssetTypesService } from '@/services/assetTypes';
import type { AssetType, AssetTypeCreate, AssetTypeUpdate, AssetTypeField } from '@/services/assetTypes';
import { AssetsService } from '@/services/assets';
import type { Asset } from '@/services/assets';
import { cn } from '@/lib/utils';
import { toast } from '@/services/toast';

interface SortConfig {
    key: 'name' | 'category' | null;
    direction: 'asc' | 'desc';
}

// Map string icon names to Lucide components
const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
    'trending-up': TrendingUp,
    'home': Home,
    'briefcase': Briefcase,
    'credit-card': CreditCard,
    'layers': Layers,
    'pie-chart': PieChart,
    'truck': Truck,
    'box': Box,
    'activity': Activity,
    'dollar-sign': DollarSign,
    'file-text': FileText,
    'bitcoin': Bitcoin,
    'anchor': Anchor,
    'image': Image,
    'droplet': Droplet,
};

const getIconComponent = (iconName: string | undefined) => {
    if (!iconName) return Box; // Default icon
    // Check if it's a known Lucide icon name
    if (ICON_MAP[iconName]) return ICON_MAP[iconName];
    // If not found, distinct visual fallback or check if it's emoji
    // Assuming mostly lucide names now based on seed.
    return Box;
};

export function AssetTypes() {
    const queryClient = useQueryClient();
    const [searchQuery, setSearchQuery] = useState('');
    const [editingType, setEditingType] = useState<AssetType | null>(null);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [sortConfig, setSortConfig] = useState<SortConfig>({ key: 'name', direction: 'asc' });

    const { data: assetTypes = [], isLoading: isLoadingTypes } = useQuery({
        queryKey: ['asset-types'],
        queryFn: AssetTypesService.getAll,
    });

    const { data: assets = [], isLoading: isLoadingAssets } = useQuery<Asset[]>({
        queryKey: ['assets'],
        queryFn: AssetsService.getAll,
    });

    const isLoading = isLoadingTypes || isLoadingAssets;

    // Calculate usage
    const typeUsage = (assets || []).reduce((acc, asset) => {
        if (asset.asset_type_id) {
            acc[asset.asset_type_id] = (acc[asset.asset_type_id] || 0) + 1;
        }
        return acc;
    }, {} as Record<number, number>);

    const createMutation = useMutation({
        mutationFn: AssetTypesService.create,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['asset-types'] });
            closeModal();
        }
    });

    const updateMutation = useMutation({
        mutationFn: ({ id, data }: { id: number; data: AssetTypeUpdate }) =>
            AssetTypesService.update(id, data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['asset-types'] });
            closeModal();
        }
    });

    const deleteMutation = useMutation({
        mutationFn: AssetTypesService.delete,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['asset-types'] });
            closeModal();
        },
        onError: (error) => {
            let message = "Failed to delete";
            if (axios.isAxiosError(error)) {
                message = error.response?.data?.detail || message;
            }
            toast.error(message);
        }
    });

    const closeModal = () => {
        setIsEditModalOpen(false);
        setIsDeleteModalOpen(false);
        setEditingType(null);
    };

    const handleEdit = (type: AssetType) => {
        setEditingType(type);
        setIsEditModalOpen(true);
    };

    const handleDelete = (e: React.MouseEvent, type: AssetType) => {
        e.preventDefault();
        e.stopPropagation();
        if (typeUsage[type.id] > 0) {
            return;
        }
        setEditingType(type);
        setIsDeleteModalOpen(true);
    };

    const handleSort = (key: SortConfig['key']) => {
        setSortConfig(current => ({
            key,
            direction: current.key === key && current.direction === 'asc' ? 'desc' : 'asc',
        }));
    };

    const filteredAndSortedTypes = assetTypes
        .filter((type: AssetType) =>
            type.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            type.category.toLowerCase().includes(searchQuery.toLowerCase())
        )
        .sort((a: AssetType, b: AssetType) => {
            if (!sortConfig.key) return 0;

            const aValue = (a[sortConfig.key] || '').toString().toLowerCase();
            const bValue = (b[sortConfig.key] || '').toString().toLowerCase();

            if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
            if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
            return 0;
        });

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="text-muted-foreground">Loading asset types...</div>
            </div>
        );
    }

    return (
        <div className="space-y-8 animate-fade-in pb-20">
            {/* Header */}
            <div className="space-y-2">
                <div className="flex items-center gap-2">
                    <Layers className="h-6 w-6 text-primary" />
                    <h1 className="text-4xl font-bold bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text">Asset Types</h1>
                </div>
                <p className="text-muted-foreground text-lg">Manage asset categories and their configurations.</p>
            </div>

            {/* Content */}
            <div className="space-y-4">
                {/* Search & Actions */}
                <div className="flex gap-4 items-center">
                    <div className="relative flex-1 group">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground group-focus-within:text-primary transition-colors" />
                        <input
                            type="text"
                            placeholder="Search asset types..."
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
                        onClick={() => {
                            setEditingType(null);
                            setIsEditModalOpen(true);
                        }}
                        variant="premium"
                        className="group shrink-0"
                    >
                        <Plus className="h-5 w-5 mr-2 group-hover:rotate-90 transition-transform duration-300" />
                        Add
                    </Button>
                </div>

                {filteredAndSortedTypes.length === 0 ? (
                    <div className="text-center py-12 bg-card rounded-xl border border-border">
                        <p className="text-muted-foreground">No asset types found matching your search.</p>
                    </div>
                ) : (
                    <>
                        {/* Desktop Table */}
                        <div className="hidden md:block glass-strong rounded-xl overflow-hidden border border-border/50">
                            <table className="w-full">
                                <thead className="bg-gradient-to-r from-primary/5 to-accent/5 backdrop-blur-sm">
                                    <tr className="text-left text-sm font-medium text-muted-foreground">
                                        <th className="px-6 py-4 w-16">Icon</th>
                                        <th
                                            className="px-6 py-4 cursor-pointer hover:text-foreground transition-colors group"
                                            onClick={() => handleSort('name')}
                                        >
                                            <div className="flex items-center gap-2">
                                                Name
                                                <ArrowUpDown className={cn("h-4 w-4 transition-opacity", sortConfig.key === 'name' ? "opacity-100" : "opacity-0 group-hover:opacity-50")} />
                                            </div>
                                        </th>
                                        <th
                                            className="px-6 py-4 cursor-pointer hover:text-foreground transition-colors group"
                                            onClick={() => handleSort('category')}
                                        >
                                            <div className="flex items-center gap-2">
                                                Category
                                                <ArrowUpDown className={cn("h-4 w-4 transition-opacity", sortConfig.key === 'category' ? "opacity-100" : "opacity-0 group-hover:opacity-50")} />
                                            </div>
                                        </th>
                                        <th className="px-6 py-4 text-center">Liability</th>
                                        <th className="px-6 py-4 text-center">Type</th>
                                        <th className="px-6 py-4 text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-border/50">
                                    {filteredAndSortedTypes.map((type: AssetType) => {
                                        const IconComponent = getIconComponent(type.icon);
                                        return (
                                            <tr
                                                key={type.id}

                                                className="group hover:bg-primary/5 transition-all duration-200 cursor-pointer"
                                            >
                                                <td className="px-6 py-4 cursor-pointer" onClick={() => handleEdit(type)}>
                                                    <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                                                        <IconComponent className="h-5 w-5" />
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 cursor-pointer" onClick={() => handleEdit(type)}>
                                                    <div className="flex flex-col">
                                                        <span className="font-semibold group-hover:text-primary transition-colors">{type.name}</span>
                                                        {typeUsage[type.id] > 0 && (
                                                            <span className="text-xs text-muted-foreground">
                                                                Used by {typeUsage[type.id]} asset{typeUsage[type.id] !== 1 ? 's' : ''}
                                                            </span>
                                                        )}
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 cursor-pointer" onClick={() => handleEdit(type)}>
                                                    <span className="px-3 py-1 bg-muted/50 rounded-full text-sm font-medium border border-border/50">
                                                        {type.category}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4 text-center cursor-pointer" onClick={() => handleEdit(type)}>
                                                    {type.is_liability && (
                                                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-red-500/10 text-red-500 border border-red-500/20">
                                                            <AlertCircle className="w-3 h-3" /> Liability
                                                        </span>
                                                    )}
                                                </td>
                                                <td className="px-6 py-4 text-center cursor-pointer" onClick={() => handleEdit(type)}>
                                                    {type.user_id ? (
                                                        <span className="text-xs text-muted-foreground">Custom</span>
                                                    ) : (
                                                        <span className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground/50 flex items-center justify-center gap-1">
                                                            <Tag className="h-3 w-3" /> System
                                                        </span>
                                                    )}
                                                </td>
                                                <td className="px-6 py-4 text-right">
                                                    {type.user_id && (
                                                        <button
                                                            onClick={(e) => {
                                                                e.preventDefault();
                                                                e.stopPropagation();
                                                                handleDelete(e, type);
                                                            }}
                                                            disabled={typeUsage[type.id] > 0}
                                                            className={cn(
                                                                "p-2 rounded-lg transition-all",
                                                                typeUsage[type.id] > 0
                                                                    ? "text-muted-foreground/30 cursor-not-allowed"
                                                                    : "text-muted-foreground hover:text-red-500 hover:bg-red-500/10"
                                                            )}
                                                            title={typeUsage[type.id] > 0 ? "Cannot delete: used by assets" : "Delete Asset Type"}
                                                        >
                                                            <Trash2 className="h-5 w-5" />
                                                        </button>
                                                    )}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>

                        {/* Mobile Cards */}
                        <div className="md:hidden space-y-4">
                            {filteredAndSortedTypes.map((type: AssetType) => {
                                const IconComponent = getIconComponent(type.icon);
                                return (
                                    <div
                                        key={type.id}

                                        className={cn(
                                            "glass-strong rounded-xl p-5 border border-border/50 transition-all duration-300 relative",
                                            type.user_id ? "hover:border-primary/30" : ""
                                        )}
                                    >
                                        <div className="flex items-start justify-between mb-4">
                                            <div className="flex items-center gap-4">
                                                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                                                    <IconComponent className="h-6 w-6" />
                                                </div>
                                                <div>
                                                    <h3 className="font-semibold text-lg">{type.name}</h3>
                                                    <div className="flex flex-wrap items-center gap-2 mt-1">
                                                        <span className="text-xs px-2 py-0.5 bg-muted/50 rounded-full border border-border/50">
                                                            {type.category}
                                                        </span>
                                                        {type.fields && type.fields.length > 0 && (
                                                            <span className="text-xs px-2 py-0.5 bg-blue-500/10 text-blue-500 rounded-full border border-blue-500/20 flex items-center gap-1">
                                                                <FileText className="w-3 h-3" /> {type.fields.length} Props
                                                            </span>
                                                        )}
                                                        {type.is_liability && (
                                                            <span className="text-xs px-2 py-0.5 bg-red-500/10 text-red-500 rounded-full border border-red-500/20 flex items-center gap-1">
                                                                <AlertCircle className="w-3 h-3" /> Liability
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                            {type.user_id && (
                                                <button
                                                    onClick={(e) => {
                                                        e.preventDefault();
                                                        e.stopPropagation();
                                                        handleDelete(e, type);
                                                    }}
                                                    disabled={typeUsage[type.id] > 0}
                                                    className={cn(
                                                        "p-2 -mr-2 transition-colors",
                                                        typeUsage[type.id] > 0
                                                            ? "text-muted-foreground/30 cursor-not-allowed"
                                                            : "text-muted-foreground hover:text-red-500 hover:bg-red-500/10"
                                                    )}
                                                    title={typeUsage[type.id] > 0 ? "Cannot delete: used by assets" : "Delete Asset Type"}
                                                >
                                                    <Trash2 className="h-5 w-5" />
                                                </button>
                                            )}
                                        </div>
                                        {!type.user_id && (
                                            <div className="absolute top-4 right-4">
                                                <span className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground/40 flex items-center gap-1">
                                                    <Tag className="h-3 w-3" /> System
                                                </span>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </>
                )}
            </div>

            {isEditModalOpen && (
                editingType ? (
                    <EditAssetTypeForm
                        type={editingType}
                        onClose={closeModal}
                        onSubmit={(data) => updateMutation.mutate({ id: editingType.id, data })}
                        onDelete={() => setIsDeleteModalOpen(true)}
                        deleteDisabled={typeUsage[editingType.id] > 0 || !editingType.user_id}
                        deleteDisabledTooltip={(!editingType.user_id) ? "System types cannot be deleted" : `Cannot delete: used by ${typeUsage[editingType.id]} asset(s)`}
                    />
                ) : (
                    <AddAssetTypeForm
                        onClose={closeModal}
                        onSubmit={(data) => createMutation.mutate(data)}
                    />
                )
            )}

            {isDeleteModalOpen && editingType && (
                <DeleteConfirmModal
                    isOpen={true}
                    onClose={() => setIsDeleteModalOpen(false)}
                    onConfirm={() => {
                        deleteMutation.mutate(editingType.id);
                        setIsDeleteModalOpen(false);
                    }}
                    title="Asset Type"
                    itemName={editingType.name}
                    warning="This will permanently remove the asset type definition. This action cannot be undone."
                    isDeleting={deleteMutation.isPending}
                />
            )}
        </div>
    );
}

function AddAssetTypeForm({ onClose, onSubmit }: {
    onClose: () => void,
    onSubmit: (data: AssetTypeCreate) => void,
}) {
    const [formData, setFormData] = useState<AssetTypeCreate>({
        name: '',
        category: 'Financial',
        icon: 'box',
        is_liability: false,
        fields: []
    });

    const categories = ['Financial', 'Real', 'Alternative', 'Liability'];

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSubmit(formData);
    };

    return (
        <AddModal
            isOpen={true}
            onClose={onClose}
            title="New Asset Type"
            className="max-w-md"
            onSubmit={handleSubmit}
            submitLabel="Create Asset Type"
            hasUnsavedChanges={!!formData.name}
        >
            <AssetTypeFormContent
                formData={formData}
                setFormData={setFormData}
                categories={categories}
            />
        </AddModal>
    );
}

function EditAssetTypeForm({ type, onClose, onSubmit, onDelete, deleteDisabled, deleteDisabledTooltip }: {
    type: AssetType,
    onClose: () => void,
    onSubmit: (data: AssetTypeUpdate) => void,
    onDelete: () => void,
    deleteDisabled?: boolean,
    deleteDisabledTooltip?: string,
}) {
    const isSystem = !type.user_id;

    const [formData, setFormData] = useState<AssetTypeCreate>({
        name: type.name,
        category: type.category,
        icon: type.icon,
        is_liability: type.is_liability,
        fields: type.fields || []
    });

    const [isDirty, setIsDirty] = useState(false);
    const categories = ['Financial', 'Real', 'Alternative', 'Liability'];

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSubmit(formData);
    };

    return (
        <EditModal
            isOpen={true}
            onClose={onClose}
            title={
                <div className="flex items-center gap-2">
                    {isSystem ? 'System Asset Type' : 'Edit Asset Type'}
                    {isSystem && (
                        <span className="px-2 py-0.5 rounded-full bg-muted text-[10px] uppercase font-bold tracking-wider text-muted-foreground border border-border">
                            Read Only
                        </span>
                    )}
                </div>
            }
            className="max-w-md"
            onSubmit={isSystem ? (e) => e.preventDefault() : handleSubmit}
            submitLabel="Save Changes"
            onDelete={!isSystem ? onDelete : undefined}
            deleteLabel="Delete Type"
            deleteDisabled={deleteDisabled}
            deleteDisabledTooltip={deleteDisabledTooltip}
            hasUnsavedChanges={isDirty}
        >
            <AssetTypeFormContent
                formData={formData}
                setFormData={(newData) => {
                    setFormData(newData);
                    setIsDirty(true);
                }}
                categories={categories}
                isSystem={isSystem}
            />
        </EditModal>
    );
}

// Shared content component to avoid duplication
function AssetTypeFormContent({ formData, setFormData, categories, isSystem = false }: {
    formData: AssetTypeCreate,
    setFormData: (data: AssetTypeCreate) => void,
    categories: string[],
    isSystem?: boolean
}) {
    return (
        <div className="space-y-4">
            <div className="space-y-2">
                <label className="text-sm font-medium">Name</label>
                <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-3 py-2 bg-background border border-border rounded-lg disabled:opacity-50"
                    placeholder="e.g. Crypto Wallet"
                    required
                    disabled={!!isSystem}
                />
            </div>

            <div className="space-y-2">
                <label className="text-sm font-medium">Category</label>
                <select
                    value={formData.category}
                    onChange={(e) => {
                        const newCategory = e.target.value as AssetType['category'];
                        setFormData({
                            ...formData,
                            category: newCategory,
                            is_liability: newCategory === 'Liability'
                        });
                    }}
                    className="w-full px-3 py-2 bg-background border border-border rounded-lg disabled:opacity-50"
                    disabled={!!isSystem}
                >
                    {categories.map((c) => (
                        <option key={c} value={c}>
                            {c}
                        </option>
                    ))}
                </select>
                {formData.category === 'Liability' && (
                    <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg flex items-start gap-2">
                        <Info className="w-4 h-4 text-red-600 mt-0.5" />
                        <div className="text-sm text-red-600">
                            <p className="font-medium">Liability Asset</p>
                            <p className="text-xs opacity-90">Assets of this type will be treated as negative values in your net worth calculation.</p>
                        </div>
                    </div>
                )}
            </div>

            <div className="space-y-2">
                <label className="text-sm font-medium">Icon</label>
                <div className="grid grid-cols-5 gap-2 p-3 bg-muted/20 border border-border rounded-xl max-h-48 overflow-y-auto">
                    {Object.entries(ICON_MAP).map(([name, Icon]) => (
                        <button
                            type="button"
                            key={name}
                            onClick={() => setFormData({ ...formData, icon: name })}
                            className={cn(
                                "p-2 rounded-lg flex items-center justify-center transition-all hover:scale-110",
                                formData.icon === name
                                    ? "bg-primary text-primary-foreground shadow-lg shadow-primary/25"
                                    : "hover:bg-primary/10 text-muted-foreground hover:text-primary"
                            )}
                            disabled={!!isSystem}
                            title={name}
                        >
                            <Icon className="h-5 w-5" />
                        </button>
                    ))}
                </div>
            </div>

            {formData.fields && formData.fields.length > 0 && (
                <div className="space-y-2 pt-2 border-t border-border">
                    <label className="text-sm font-medium flex items-center gap-2">
                        <FileText className="w-4 h-4 text-primary" />
                        Properties ({formData.fields.length})
                    </label>
                    <div className="space-y-2">
                        {formData.fields.map((field: AssetTypeField, idx: number) => (
                            <div key={idx} className="flex items-center justify-between p-2 bg-muted/30 rounded-lg text-sm border border-border/50">
                                <span className="font-medium">{field.name}</span>
                                <span className="text-xs text-muted-foreground px-2 py-0.5 bg-background rounded border border-border">
                                    {field.type}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
