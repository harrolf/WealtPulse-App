import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { AssetsService } from '@/services/assets';
import type { Asset, AssetUpdate } from '@/services/assets';
import type { AssetType } from '@/services/assetTypes';
import type { Custodian } from '@/services/custodians';
import type { Tag } from '@/services/tags';
import { EditModal } from '../ui/EditModal';
import { FormLabel } from '../ui/inputs/FormLabel';
import { DateInput } from '../ui/inputs/DateInput';
import { CurrencyInput } from '../ui/inputs/CurrencyInput';
import { cn } from '@/lib/utils';

interface EditAssetFormProps {
    asset: Asset;
    onClose: () => void;
    onSuccess?: (asset: Asset) => void;
    onDelete?: () => void;
    deleteDisabled?: boolean;
    deleteDisabledTooltip?: string;
    // Data props to avoid refetching inside the form
    assetTypes?: AssetType[];
    custodians?: Custodian[];
    primaryGroups?: { id: number; name: string }[];
    tags?: Tag[];
}

export function EditAssetForm({
    asset,
    onClose,
    onSuccess,
    onDelete,
    deleteDisabled,
    deleteDisabledTooltip,
    assetTypes,
    custodians,
    primaryGroups,
    tags
}: EditAssetFormProps) {
    const queryClient = useQueryClient();

    // Initialize form state with valid existing asset data
    const [formData, setFormData] = useState<AssetUpdate>({
        name: asset.name,
        currency: asset.currency,
        asset_type_id: asset.asset_type_id,
        custodian_id: asset.custodian_id,
        group_id: asset.group_id,
        quantity: asset.quantity,
        purchase_price: asset.purchase_price,
        notes: asset.notes,
        custom_fields: asset.custom_fields || {},
        purchase_date: asset.purchase_date,
        ticker_symbol: asset.ticker_symbol,
        tag_ids: asset.tags?.map(t => t.id) || []
    });

    const [isDirty, setIsDirty] = useState(false);

    // Mutations
    const mutation = useMutation({
        mutationFn: async (data: AssetUpdate) => {
            return AssetsService.update(asset.id, data);
        },
        onSuccess: (data) => {
            queryClient.invalidateQueries({ queryKey: ['assets'] });
            queryClient.invalidateQueries({ queryKey: ['portfolio-allocation'] });
            queryClient.invalidateQueries({ queryKey: ['portfolio-history'] });
            onSuccess?.(data);
            onClose();
        },
    });

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        mutation.mutate(formData);
    };

    // Helper to safely update nested state
    const updateField = (field: keyof AssetUpdate, value: string | number | boolean | number[] | undefined) => {
        setFormData(prev => ({ ...prev, [field]: value }));
        setIsDirty(true);
    };

    const updateCustomField = (key: string, value: string | number) => {
        setFormData(prev => ({
            ...prev,
            custom_fields: {
                ...prev.custom_fields,
                [key]: value
            }
        }));
        setIsDirty(true);
    };

    // Derived logic for UI
    const selectedAssetType = assetTypes?.find(t => t.id === formData.asset_type_id);
    const dynamicFields = selectedAssetType?.fields || [];

    return (
        <EditModal
            isOpen={true}
            onClose={onClose}
            title={
                <span className="bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
                    Edit {asset.name}
                </span>
            }
            hasUnsavedChanges={isDirty}
            onSubmit={handleSubmit}
            submitLabel="Save Changes"
            isSubmitting={mutation.isPending}
            className="max-w-2xl"
            onDelete={onDelete}
            deleteLabel="Delete Asset"
            deleteDisabled={deleteDisabled}
            deleteDisabledTooltip={deleteDisabledTooltip}
        >
            <div className="space-y-6">
                {/* Basic Info */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="md:col-span-2 space-y-1.5">
                        <FormLabel required>Asset Name</FormLabel>
                        <input
                            type="text"
                            value={formData.name || ''}
                            onChange={(e) => updateField('name', e.target.value)}
                            className="w-full px-3 py-2 bg-background border border-border rounded-lg"
                            required
                        />
                    </div>

                    {selectedAssetType?.name !== 'Exchange' && (
                        <div className="space-y-1.5">
                            <FormLabel>Ticker Symbol (Optional)</FormLabel>
                            <input
                                type="text"
                                value={formData.ticker_symbol || ''}
                                onChange={(e) => updateField('ticker_symbol', e.target.value.toUpperCase())}
                                className="w-full px-3 py-2 bg-background border border-border rounded-lg font-mono uppercase"
                                placeholder="e.g. AAPL"
                            />
                        </div>
                    )}

                    <div className="space-y-1.5">
                        <FormLabel>Currency</FormLabel>
                        <input
                            type="text"
                            value={formData.currency}
                            onChange={(e) => updateField('currency', e.target.value.toUpperCase())}
                            className="w-full px-3 py-2 bg-background border border-border rounded-lg font-mono"
                            maxLength={3}
                        />
                    </div>
                </div>

                {/* Classification */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t border-border/50">
                    <div className="space-y-1.5">
                        <FormLabel>Asset Type</FormLabel>
                        <select
                            value={formData.asset_type_id || ''}
                            onChange={(e) => updateField('asset_type_id', Number(e.target.value))}
                            className="w-full px-3 py-2 bg-background border border-border rounded-lg"
                        >
                            <option value="">Select Type...</option>
                            {assetTypes?.map(t => (
                                <option key={t.id} value={t.id}>{t.name}</option>
                            ))}
                        </select>
                    </div>

                    <div className="space-y-1.5">
                        <FormLabel>Custodian / Platform</FormLabel>
                        <select
                            value={formData.custodian_id || ''}
                            onChange={(e) => updateField('custodian_id', Number(e.target.value))}
                            className="w-full px-3 py-2 bg-background border border-border rounded-lg"
                        >
                            <option value="">Select Custodian...</option>
                            {custodians?.map(c => (
                                <option key={c.id} value={c.id}>{c.name}</option>
                            ))}
                        </select>
                    </div>

                    <div className="space-y-1.5">
                        <FormLabel>Primary Group</FormLabel>
                        <select
                            value={formData.group_id || ''}
                            onChange={(e) => updateField('group_id', Number(e.target.value))}
                            className="w-full px-3 py-2 bg-background border border-border rounded-lg"
                        >
                            <option value="">Select Group...</option>
                            {primaryGroups?.map(g => (
                                <option key={g.id} value={g.id}>{g.name}</option>
                            ))}
                        </select>
                    </div>
                </div>

                {/* Dynamic Fields from Asset Type */}
                {dynamicFields.length > 0 && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t border-border/50">
                        {dynamicFields.map(field => (
                            <div key={field.name} className={field.type === 'text' && !field.options ? "md:col-span-2" : ""}>
                                <FormLabel required={field.required}>{field.name}</FormLabel>
                                {field.type === 'select' && field.options ? (
                                    <select
                                        value={(formData.custom_fields?.[field.name] as string) || ''}
                                        onChange={(e) => updateCustomField(field.name, e.target.value)}
                                        required={field.required}
                                        className="w-full px-3 py-2 bg-background border border-border rounded-lg"
                                    >
                                        <option value="">Select {field.name}...</option>
                                        {field.options.map((opt: string) => (
                                            <option key={opt} value={opt}>{opt}</option>
                                        ))}
                                    </select>
                                ) : field.type === 'date' ? (
                                    <DateInput
                                        value={formData.custom_fields?.[field.name] ? new Date(formData.custom_fields?.[field.name] as string).toISOString().split('T')[0] : ''}
                                        onChange={(e) => updateCustomField(field.name, e.target.value)}
                                        required={field.required}
                                    />
                                ) : (
                                    <div className="relative">
                                        <input
                                            type={field.type}
                                            value={(formData.custom_fields?.[field.name] as string) || ''}
                                            onChange={(e) => updateCustomField(field.name, e.target.value)}
                                            required={field.required}
                                            className={cn(
                                                "w-full px-3 py-2 bg-background border border-border rounded-lg",
                                                field.suffix && "pr-8"
                                            )}
                                        />
                                        {field.suffix && (
                                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm font-medium">
                                                {field.suffix}
                                            </span>
                                        )}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                )}

                {/* Value & Performance */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t border-border/50">
                    <div className="space-y-1.5">
                        <FormLabel>Quantity / Units</FormLabel>
                        <input
                            type="number"
                            value={formData.quantity || ''}
                            onChange={(e) => updateField('quantity', parseFloat(e.target.value))}
                            className="w-full px-3 py-2 bg-background border border-border rounded-lg"
                            step="any"
                        />
                    </div>

                    <div className="space-y-1.5">
                        <FormLabel>Purchase Price (Unit)</FormLabel>
                        <CurrencyInput
                            value={formData.purchase_price || 0}
                            onChange={(val) => updateField('purchase_price', val)}
                            currency={formData.currency || ''}
                        />
                    </div>

                    <div className="space-y-1.5">
                        <FormLabel>Purchase Date</FormLabel>
                        <DateInput
                            value={formData.purchase_date || ''}
                            onChange={(e) => updateField('purchase_date', e.target.value)}
                        />
                    </div>
                </div>

                {/* Tags */}
                <div className="pt-4 border-t border-border/50">
                    <FormLabel>Tags</FormLabel>
                    <div className="flex flex-wrap gap-2 mt-2">
                        {tags?.map(tag => (
                            <button
                                key={tag.id}
                                type="button"
                                onClick={() => {
                                    const currentTags = formData.tag_ids || [];
                                    const newTags = currentTags.includes(tag.id)
                                        ? currentTags.filter(id => id !== tag.id)
                                        : [...currentTags, tag.id];
                                    updateField('tag_ids', newTags);
                                }}
                                className={cn(
                                    "px-3 py-1 rounded-full text-xs font-medium transition-all border",
                                    formData.tag_ids?.includes(tag.id)
                                        ? "bg-primary/20 border-primary text-primary"
                                        : "bg-background border-border text-muted-foreground hover:border-primary/50"
                                )}
                            >
                                {tag.name}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Additional Details */}
                <div className="pt-4 border-t border-border/50">
                    <div className="space-y-1.5">
                        <FormLabel>Notes</FormLabel>
                        <textarea
                            value={formData.notes || ''}
                            onChange={(e) => updateField('notes', e.target.value)}
                            className="w-full px-3 py-2 bg-background border border-border rounded-lg min-h-[80px]"
                            placeholder="Optional notes..."
                        />
                    </div>
                </div>
            </div>
        </EditModal>
    );
}
