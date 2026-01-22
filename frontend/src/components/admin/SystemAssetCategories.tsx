import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Edit, Trash2, Tag, Info } from 'lucide-react';
import { AssetCategoriesService } from '@/services/assetCategories';
import type { AssetTypeCategory, AssetTypeCategoryCreate } from '@/services/assetCategories';
import { Modal } from '@/components/ui/Modal';
import { CollapsibleSection } from '@/components/ui/CollapsibleSection';

export function SystemAssetCategories() {
    const queryClient = useQueryClient();
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [editingCategory, setEditingCategory] = useState<AssetTypeCategory | null>(null);
    const [formData, setFormData] = useState<AssetTypeCategoryCreate>({
        name: '',
        description: '',
        is_system: false,
        display_config: {},
    });

    const { data: categories = [], isLoading } = useQuery({
        queryKey: ['asset-categories'],
        queryFn: AssetCategoriesService.getAll,
    });

    const createMutation = useMutation({
        mutationFn: AssetCategoriesService.create,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['asset-categories'] });
            setIsEditModalOpen(false);
            resetForm();
        },
    });

    const updateMutation = useMutation({
        mutationFn: (data: { id: number; payload: Partial<AssetTypeCategory> }) =>
            AssetCategoriesService.update(data.id, data.payload),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['asset-categories'] });
            setIsEditModalOpen(false);
            resetForm();
        },
    });

    const deleteMutation = useMutation({
        mutationFn: AssetCategoriesService.delete,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['asset-categories'] });
        },
    });

    const resetForm = () => {
        setFormData({ name: '', description: '', is_system: false, display_config: {} });
        setEditingCategory(null);
    };

    const handleEdit = (category: AssetTypeCategory) => {
        setEditingCategory(category);
        setFormData({
            name: category.name,
            description: category.description || '',
            is_system: category.is_system,
            display_config: category.display_config || {},
        });
        setIsEditModalOpen(true);
    };

    const handleDelete = async (id: number) => {
        if (confirm('Are you sure you want to delete this category?')) {
            deleteMutation.mutate(id);
        }
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (editingCategory) {
            updateMutation.mutate({ id: editingCategory.id, payload: formData });
        } else {
            createMutation.mutate(formData);
        }
    };

    if (isLoading) return <div className="p-8 text-center text-muted-foreground">Loading categories...</div>;

    return (
        <div className="space-y-6 animate-slide-up">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-xl font-semibold flex items-center gap-2">
                        <Tag className="w-5 h-5 text-primary" />
                        System Asset Categories
                    </h2>
                    <p className="text-sm text-muted-foreground mt-1">
                        Manage the high-level categories for grouping assets.
                    </p>
                </div>
                <button
                    onClick={() => { resetForm(); setIsEditModalOpen(true); }}
                    className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors font-medium text-sm"
                >
                    <Plus className="w-4 h-4" />
                    New Category
                </button>
            </div>

            <div className="glass-strong rounded-xl border border-border/50 overflow-hidden">
                <table className="w-full">
                    <thead className="bg-gradient-to-r from-primary/5 to-accent/5 backdrop-blur-sm">
                        <tr className="text-left text-sm font-medium text-muted-foreground border-b border-border/50">
                            <th className="px-6 py-4">Name</th>
                            <th className="px-6 py-4">Description</th>
                            <th className="px-6 py-4">Type</th>
                            <th className="px-6 py-4 text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-border/50">
                        {isLoading ? (
                            <tr><td colSpan={4} className="p-8 text-center text-muted-foreground">Loading categories...</td></tr>
                        ) : categories.map((category) => (
                            <tr key={category.id} className="group hover:bg-primary/5 transition-colors">
                                <td className="px-6 py-4 font-medium text-foreground">
                                    {category.name}
                                </td>
                                <td className="px-6 py-4 text-sm text-muted-foreground">
                                    {category.description || <span className="text-muted-foreground/50 italic">No description</span>}
                                </td>
                                <td className="px-6 py-4">
                                    {category.is_system ? (
                                        <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-500 border border-blue-500/20 text-[10px] font-medium uppercase tracking-wider">
                                            <Info className="w-3 h-3" /> System
                                        </div>
                                    ) : (
                                        <span className="text-sm text-muted-foreground">User Defined</span>
                                    )}
                                </td>
                                <td className="px-6 py-4 text-right">
                                    <div className="flex items-center justify-end gap-2">
                                        <button
                                            onClick={() => handleEdit(category)}
                                            className="p-2 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-lg transition-colors"
                                            title="Edit Category"
                                        >
                                            <Edit className="w-4 h-4" />
                                        </button>
                                        {!category.is_system && (
                                            <button
                                                onClick={() => handleDelete(category.id)}
                                                className="p-2 text-muted-foreground hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-colors"
                                                title="Delete Category"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        )}
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Edit/Create Modal */}
            <Modal
                isOpen={isEditModalOpen}
                onClose={() => setIsEditModalOpen(false)}
                title={editingCategory ? 'Edit Category' : 'New Category'}
            >
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="space-y-2">
                        <label className="text-sm font-medium">Name</label>
                        <input
                            type="text"
                            value={formData.name}
                            onChange={e => setFormData({ ...formData, name: e.target.value })}
                            className="w-full px-3 py-2 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all font-medium"
                            required
                            placeholder="e.g. Digital Assets"
                            autoFocus
                        />
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-medium">Description</label>
                        <textarea
                            value={formData.description}
                            onChange={e => setFormData({ ...formData, description: e.target.value })}
                            className="w-full px-3 py-2 bg-background border border-border rounded-lg min-h-[100px] focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all resize-none"
                            placeholder="Optional description..."
                        />
                    </div>

                    <CollapsibleSection title="Form Layout & Standard Fields" defaultOpen={false}>
                        <div className="space-y-4 text-sm">
                            <p className="text-xs text-muted-foreground">Control which standard fields are visible by default for all Asset Types in this category. (Can serve as a template).</p>

                            <div className="grid grid-cols-2 gap-4">
                                <label className="flex items-center gap-2 cursor-pointer p-2 rounded hover:bg-white/5 border border-transparent hover:border-white/10 transition-colors">
                                    <input
                                        type="checkbox"
                                        checked={formData.display_config?.show_currency !== false}
                                        onChange={e => setFormData(prev => ({
                                            ...prev,
                                            display_config: { ...prev.display_config, show_currency: e.target.checked }
                                        }))}
                                        className="rounded border-border bg-transparent text-primary focus:ring-primary"
                                    />
                                    <span>Currency</span>
                                </label>

                                <label className="flex items-center gap-2 cursor-pointer p-2 rounded hover:bg-white/5 border border-transparent hover:border-white/10 transition-colors">
                                    <input
                                        type="checkbox"
                                        checked={formData.display_config?.show_ticker !== false}
                                        onChange={e => setFormData(prev => ({
                                            ...prev,
                                            display_config: { ...prev.display_config, show_ticker: e.target.checked }
                                        }))}
                                        className="rounded border-border bg-transparent text-primary focus:ring-primary"
                                    />
                                    <span>Ticker Symbol</span>
                                </label>

                                <label className="flex items-center gap-2 cursor-pointer p-2 rounded hover:bg-white/5 border border-transparent hover:border-white/10 transition-colors">
                                    <input
                                        type="checkbox"
                                        checked={formData.display_config?.show_quantity !== false}
                                        onChange={e => setFormData(prev => ({
                                            ...prev,
                                            display_config: { ...prev.display_config, show_quantity: e.target.checked }
                                        }))}
                                        className="rounded border-border bg-transparent text-primary focus:ring-primary"
                                    />
                                    <span>Quantity</span>
                                </label>

                                <label className="flex items-center gap-2 cursor-pointer p-2 rounded hover:bg-white/5 border border-transparent hover:border-white/10 transition-colors">
                                    <input
                                        type="checkbox"
                                        checked={formData.display_config?.show_purchase_date !== false}
                                        onChange={e => setFormData(prev => ({
                                            ...prev,
                                            display_config: { ...prev.display_config, show_purchase_date: e.target.checked }
                                        }))}
                                        className="rounded border-border bg-transparent text-primary focus:ring-primary"
                                    />
                                    <span>Purchase Date</span>
                                </label>

                                <label className="flex items-center gap-2 cursor-pointer p-2 rounded hover:bg-white/5 border border-transparent hover:border-white/10 transition-colors">
                                    <input
                                        type="checkbox"
                                        checked={formData.display_config?.show_unit_price !== false}
                                        onChange={e => setFormData(prev => ({
                                            ...prev,
                                            display_config: { ...prev.display_config, show_unit_price: e.target.checked }
                                        }))}
                                        className="rounded border-border bg-transparent text-primary focus:ring-primary"
                                    />
                                    <span>Price per Unit / Loan Amount</span>
                                </label>
                            </div>

                            <div className="pt-2 border-t border-white/10">
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={formData.display_config?.collapse_tags_default === true}
                                        onChange={e => setFormData(prev => ({
                                            ...prev,
                                            display_config: { ...prev.display_config, collapse_tags_default: e.target.checked }
                                        }))}
                                        className="rounded border-border bg-transparent text-primary focus:ring-primary"
                                    />
                                    <span className="text-muted-foreground">Default "Tags & Grouping" to collapsed</span>
                                </label>
                            </div>
                        </div>
                    </CollapsibleSection>

                    <div className="flex justify-end gap-3 pt-4 border-t border-border/50">
                        <button
                            type="button"
                            onClick={() => setIsEditModalOpen(false)}
                            className="px-4 py-2 hover:bg-muted rounded-lg transition-colors text-sm font-medium"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={createMutation.isPending || updateMutation.isPending}
                            className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors text-sm font-medium"
                        >
                            {editingCategory ? 'Save Changes' : 'Create Category'}
                        </button>
                    </div>
                </form>
            </Modal>
        </div>
    );
}
