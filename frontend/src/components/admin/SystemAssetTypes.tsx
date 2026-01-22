
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2, Edit2, Save, X, PlusCircle, LayoutGrid } from 'lucide-react';
import * as Icons from 'lucide-react';
import { AssetTypesService } from '@/services/assetTypes';
import { AssetCategoriesService } from '@/services/assetCategories';
import type { AssetType, AssetTypeCreate, AssetTypeUpdate, AssetTypeField } from '@/services/assetTypes';
import { Modal } from '@/components/ui/Modal';
import { ConfirmationModal } from '@/components/ui/ConfirmationModal';
import { FormLabel } from '@/components/ui/inputs/FormLabel';
import { toast } from '@/services/toast';
import { CollapsibleSection } from '@/components/ui/CollapsibleSection';
import { cn } from '@/lib/utils';

export function SystemAssetTypes() {
    const queryClient = useQueryClient();
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [editingType, setEditingType] = useState<AssetType | null>(null);
    const [confirmDelete, setConfirmDelete] = useState<number | null>(null);

    // Form State
    const [formData, setFormData] = useState<AssetTypeCreate>({
        name: '',
        category: '',
        category_id: undefined,
        icon: 'box',
        fields: [],
        display_config: {},
        is_liability: false,
        supports_pricing: true,
    });

    const { data: categories = [] } = useQuery({
        queryKey: ['asset-categories'],
        queryFn: AssetCategoriesService.getAll,
    });

    const { data: assetTypes = [], isLoading } = useQuery({
        queryKey: ['admin-asset-types'],
        queryFn: AssetTypesService.getSystem
    });

    const createMutation = useMutation({
        mutationFn: AssetTypesService.createSystem,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['admin-asset-types'] });
            setIsEditModalOpen(false);
            resetForm();
            toast.success("Asset Type created successfully");
        },
        onError: (err: Error & { response?: { data?: { detail?: string } } }) => {
            toast.error(err.response?.data?.detail || "Failed to create asset type");
        }
    });

    const updateMutation = useMutation({
        mutationFn: ({ id, data }: { id: number, data: AssetTypeUpdate }) => AssetTypesService.updateSystem(id, data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['admin-asset-types'] });
            setIsEditModalOpen(false);
            resetForm();
            toast.success("Asset Type updated successfully");
        },
        onError: (err: Error & { response?: { data?: { detail?: string } } }) => {
            toast.error(err.response?.data?.detail || "Failed to update asset type");
        }
    });

    const deleteMutation = useMutation({
        mutationFn: AssetTypesService.deleteSystem,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['admin-asset-types'] });
            setConfirmDelete(null);
            toast.success("Asset Type deleted successfully");
        },
        onError: (err: Error & { response?: { data?: { detail?: string } } }) => {
            toast.error(err.response?.data?.detail || "Failed to delete asset type");
            setConfirmDelete(null);
        }
    });

    const resetForm = () => {
        setFormData({
            name: '',
            category: '',
            category_id: undefined,
            icon: 'box',
            fields: [],
            display_config: {},
            is_liability: false,
            supports_pricing: true,
        });
        setEditingType(null);
    };

    const handleEdit = (type: AssetType) => {
        setEditingType(type);
        setFormData({
            name: type.name,
            category: type.category,
            category_id: type.category_id,
            icon: type.icon || 'box',
            fields: type.fields || [],
            display_config: type.display_config || {},
            is_liability: type.is_liability,
            supports_pricing: type.supports_pricing,
        });
        setIsEditModalOpen(true);
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (editingType) {
            updateMutation.mutate({ id: editingType.id, data: formData });
        } else {
            createMutation.mutate(formData);
        }
    };

    // --- Field Management Helpers ---

    const addField = () => {
        setFormData(prev => ({
            ...prev,
            fields: [...(prev.fields || []), { name: '', type: 'text' }]
        }));
    };

    const removeField = (index: number) => {
        setFormData(prev => ({
            ...prev,
            fields: prev.fields?.filter((_, i) => i !== index)
        }));
    };

    const updateField = (index: number, key: keyof AssetTypeField, value: string | number | boolean | string[]) => {
        setFormData(prev => {
            const newFields = [...(prev.fields || [])];
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            newFields[index] = { ...newFields[index], [key]: value } as any;
            return { ...prev, fields: newFields };
        });
    };

    const iconOptions = ['trending-up', 'layers', 'file-text', 'pie-chart', 'bitcoin', 'dollar-sign', 'briefcase', 'home', 'truck', 'anchor', 'image', 'box', 'droplet', 'activity', 'credit-card', 'wallet'];


    // ... inside function ...

    // Helper component to render dynamic icons safely
    const DynamicIcon = ({ name, className }: { name: string; className?: string }) => {
        // @ts-expect-error - Dynamic access to module exports
        const IconComponent = Icons[name.charAt(0).toUpperCase() + name.slice(1).replace(/-([a-z])/g, g => g[1].toUpperCase())] || Icons.Box;
        // The above transforms 'trending-up' -> 'TrendingUp' etc.
        // Fallback to Box if not found

        // Manual map for common ones if casing is tricky
        const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
            'trending-up': Icons.TrendingUp,
            'layers': Icons.Layers,
            'file-text': Icons.FileText,
            'pie-chart': Icons.PieChart,
            'bitcoin': Icons.Bitcoin,
            'dollar-sign': Icons.DollarSign,
            'briefcase': Icons.Briefcase,
            'home': Icons.Home,
            'truck': Icons.Truck,
            'anchor': Icons.Anchor,
            'image': Icons.Image,
            'box': Icons.Box,
            'droplet': Icons.Droplet,
            'activity': Icons.Activity,
            'credit-card': Icons.CreditCard,
            'wallet': Icons.Wallet,
        };

        const Component = iconMap[name] || IconComponent;
        return <Component className={className} />;
    };

    return (
        <div className="space-y-6 animate-slide-up">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-xl font-semibold flex items-center gap-2">
                        <LayoutGrid className="w-5 h-5 text-primary" />
                        System Asset Types
                    </h2>
                    <p className="text-sm text-muted-foreground mt-1">
                        Configure global asset definitions available to all users.
                    </p>
                </div>
                <button
                    onClick={() => { resetForm(); setIsEditModalOpen(true); }}
                    className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors font-medium text-sm"
                >
                    <Plus className="w-4 h-4" />
                    New Type
                </button>
            </div>

            <div className="glass-strong rounded-xl border border-border/50 overflow-hidden">
                <table className="w-full">
                    <thead className="bg-gradient-to-r from-primary/5 to-accent/5 backdrop-blur-sm">
                        <tr className="text-left text-sm font-medium text-muted-foreground border-b border-border/50">
                            <th className="px-6 py-4">Icon</th>
                            <th className="px-6 py-4">Name</th>
                            <th className="px-6 py-4">Category</th>
                            <th className="px-6 py-4">Custom Fields</th>
                            <th className="px-6 py-4">Type</th>
                            <th className="px-6 py-4 text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-border/50">
                        {isLoading ? (
                            <tr><td colSpan={6} className="p-8 text-center text-muted-foreground">Loading definitions...</td></tr>
                        ) : assetTypes.map((type) => (
                            <tr key={type.id} className="group hover:bg-primary/5 transition-colors">
                                <td className="px-6 py-4">
                                    <div className="p-2 bg-primary/10 rounded-lg text-primary w-fit">
                                        <DynamicIcon name={type.icon || 'box'} className="w-5 h-5" />
                                    </div>
                                </td>
                                <td className="px-6 py-4 font-medium text-foreground">
                                    {type.name}
                                </td>
                                <td className="px-6 py-4">
                                    <span className={cn("text-xs px-2 py-0.5 rounded-full border font-medium",
                                        type.category === 'Financial' ? "bg-blue-500/10 text-blue-500 border-blue-500/20" :
                                            type.category === 'Real' ? "bg-amber-500/10 text-amber-500 border-amber-500/20" :
                                                type.category === 'Liability' ? "bg-red-500/10 text-red-500 border-red-500/20" :
                                                    "bg-purple-500/10 text-purple-500 border-purple-500/20"
                                    )}>
                                        {type.category}
                                    </span>
                                </td>
                                <td className="px-6 py-4">
                                    {type.fields && type.fields.length > 0 ? (
                                        <div className="flex flex-wrap gap-1">
                                            {type.fields.map((f, i) => (
                                                <span key={i} className="text-xs bg-white/5 border border-white/10 rounded px-1.5 py-0.5 text-muted-foreground">
                                                    {f.name}
                                                </span>
                                            ))}
                                        </div>
                                    ) : (
                                        <span className="text-xs text-muted-foreground/50 italic">None</span>
                                    )}
                                </td>
                                <td className="px-6 py-4 text-sm">
                                    {type.is_liability ? (
                                        <span className="text-red-400">Liability</span>
                                    ) : (
                                        <span className="text-emerald-400">Asset</span>
                                    )}
                                </td>
                                <td className="px-6 py-4 text-right">
                                    <div className="flex items-center justify-end gap-2">
                                        <button
                                            onClick={() => handleEdit(type)}
                                            className="p-2 hover:bg-white/10 rounded-lg text-muted-foreground hover:text-primary transition-colors"
                                            title="Edit Type"
                                        >
                                            <Edit2 className="w-4 h-4" />
                                        </button>
                                        <button
                                            onClick={() => setConfirmDelete(type.id)}
                                            className="p-2 hover:bg-red-500/10 rounded-lg text-muted-foreground hover:text-red-500 transition-colors"
                                            title="Delete Type"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Create/Edit Modal */}
            <Modal
                isOpen={isEditModalOpen}
                onClose={() => setIsEditModalOpen(false)}
                className="max-w-4xl"
                title={editingType ? `Edit ${editingType.name}` : "Create Asset Type"}
            >
                <form onSubmit={handleSubmit} className="space-y-6">
                    <CollapsibleSection title="Core Configuration" defaultOpen={true}>
                        <div className="space-y-4">
                            <div>
                                <FormLabel required>Name</FormLabel>
                                <input
                                    type="text"
                                    value={formData.name}
                                    onChange={e => setFormData(prev => ({ ...prev, name: e.target.value }))}
                                    className="w-full px-3 py-2 bg-background border border-border rounded-lg"
                                    required
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <FormLabel required>Category</FormLabel>
                                    <select
                                        value={formData.category_id || ''}
                                        onChange={e => {
                                            const id = Number(e.target.value);
                                            // eslint-disable-next-line @typescript-eslint/no-explicit-any
                                            const cat = categories.find((c: any) => c.id === id);
                                            setFormData(prev => ({
                                                ...prev,
                                                category_id: id,
                                                category: cat?.name || ''
                                            }));
                                        }}
                                        className="w-full px-3 py-2 bg-background border border-border rounded-lg"
                                        required
                                    >
                                        <option value="" disabled>Select Category</option>
                                        {categories.map((cat: { id: number; name: string }) => (
                                            <option key={cat.id} value={cat.id}>{cat.name}</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <FormLabel>Icon</FormLabel>
                                    <select
                                        value={formData.icon}
                                        onChange={e => setFormData(prev => ({ ...prev, icon: e.target.value }))}
                                        className="w-full px-3 py-2 bg-background border border-border rounded-lg"
                                    >
                                        {iconOptions.map(icon => (
                                            <option key={icon} value={icon}>{icon}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                            <div className="flex items-center gap-2 pt-2">
                                <input
                                    type="checkbox"
                                    id="is_liability"
                                    checked={formData.is_liability}
                                    onChange={e => setFormData(prev => ({ ...prev, is_liability: e.target.checked }))}
                                    className="w-4 h-4 rounded border-border bg-white/5 text-primary focus:ring-primary"
                                />
                                <label htmlFor="is_liability" className="text-sm cursor-pointer select-none">Treat as Liability (Debt)</label>
                            </div>
                            <div className="flex items-center gap-2">
                                <input
                                    type="checkbox"
                                    id="supports_pricing"
                                    checked={formData.supports_pricing ?? true}
                                    onChange={e => setFormData(prev => ({ ...prev, supports_pricing: e.target.checked }))}
                                    className="w-4 h-4 rounded border-border bg-white/5 text-primary focus:ring-primary"
                                />
                                <label htmlFor="supports_pricing" className="text-sm cursor-pointer select-none">Enable Price History / Revalue</label>
                            </div>
                        </div>
                    </CollapsibleSection>


                    <CollapsibleSection title="Custom Attributes (Details)" defaultOpen={true}>
                        <div className="space-y-4">
                            <div className="flex items-center justify-between">
                                <p className="text-xs text-muted-foreground">Define specific data points to collect for this asset type.</p>
                                <button type="button" onClick={addField} className="text-xs flex items-center gap-1 text-primary hover:text-primary/80">
                                    <PlusCircle className="w-3 h-3" /> Add Field
                                </button>
                            </div>

                            <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2">
                                {(formData.fields || []).map((field, idx) => (
                                    <div key={idx} className="p-3 bg-white/5 rounded-lg border border-white/10 space-y-3">
                                        <div className="flex gap-2">
                                            <div className="flex-1">
                                                <input
                                                    type="text"
                                                    placeholder="Field Name"
                                                    value={field.name}
                                                    onChange={e => updateField(idx, 'name', e.target.value)}
                                                    className="w-full px-2 py-1.5 bg-background border border-border rounded text-sm"
                                                    required
                                                />
                                            </div>
                                            <div className="w-28">
                                                <select
                                                    value={field.type}
                                                    onChange={e => updateField(idx, 'type', e.target.value)}
                                                    className="w-full px-2 py-1.5 bg-background border border-border rounded text-sm"
                                                >
                                                    <option value="text">Text</option>
                                                    <option value="number">Number</option>
                                                    <option value="date">Date</option>
                                                    <option value="select">Select</option>
                                                </select>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => removeField(idx)}
                                                className="p-1.5 hover:bg-red-500/10 text-muted-foreground hover:text-red-500 rounded"
                                            >
                                                <X className="w-4 h-4" />
                                            </button>
                                        </div>

                                        <div className="flex gap-4 text-xs">
                                            <label className="flex items-center gap-1 cursor-pointer">
                                                <input
                                                    type="checkbox"
                                                    checked={field.required}
                                                    onChange={e => updateField(idx, 'required', e.target.checked)}
                                                    className="rounded border-border bg-transparent"
                                                />
                                                Required
                                            </label>
                                            <input
                                                type="text"
                                                placeholder="Suffix (e.g. %)"
                                                value={field.suffix || ''}
                                                onChange={e => updateField(idx, 'suffix', e.target.value)}
                                                className="bg-transparent border-b border-white/10 focus:border-primary px-1 w-20"
                                            />
                                        </div>

                                        {field.type === 'select' && (
                                            <div>
                                                <input
                                                    type="text"
                                                    placeholder="Options (comma separated)"
                                                    value={field.options?.join(', ') || ''}
                                                    onChange={e => updateField(idx, 'options', e.target.value.split(',').map(s => s.trim()))}
                                                    className="w-full px-2 py-1.5 bg-background border border-border rounded text-sm"
                                                />
                                            </div>
                                        )}
                                    </div>
                                ))}
                                {(!formData.fields || formData.fields.length === 0) && (
                                    <div className="text-center py-8 text-sm text-muted-foreground/50 border border-dashed border-white/10 rounded-lg">
                                        No custom fields defined
                                    </div>
                                )}
                            </div>
                        </div>
                    </CollapsibleSection>

                    <div className="flex justify-end gap-3 pt-4 border-t border-white/10">
                        <button
                            type="button"
                            onClick={() => setIsEditModalOpen(false)}
                            className="px-4 py-2 bg-muted text-foreground rounded-lg hover:bg-muted/80 transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={createMutation.isPending || updateMutation.isPending}
                            className="flex items-center gap-2 px-6 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50"
                        >
                            <Save className="w-4 h-4" />
                            {editingType ? 'Update Definition' : 'Create Definition'}
                        </button>
                    </div>
                </form>
            </Modal>

            <ConfirmationModal
                isOpen={!!confirmDelete}
                onClose={() => setConfirmDelete(null)}
                onConfirm={() => confirmDelete && deleteMutation.mutate(confirmDelete)}
                title="Delete Asset Type"
                message="Are you sure you want to delete this asset type? This action cannot be undone."
                confirmText="Delete"
                variant="danger"
            />
        </div >
    );
}
