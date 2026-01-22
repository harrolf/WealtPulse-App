import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, ArrowLeft, TrendingUp, Home, Briefcase, CreditCard, Layers, PieChart, Truck, Box, Activity, DollarSign, FileText, Bitcoin, Anchor, Image, Droplet } from 'lucide-react';
import api from '@/services/api'; // Still needed for settings if not refactored
import { cn } from '@/lib/utils';
import { AddCustodianForm } from './AddCustodianForm';
import { AddGroupForm } from './AddGroupForm';
import { AddTagForm } from './AddTagForm';
import { FormLabel } from '../ui/inputs/FormLabel';
import { DateInput } from '../ui/inputs/DateInput';
import { CurrencyInput } from '../ui/inputs/CurrencyInput';
import { AddModal } from '../ui/AddModal';

import { AssetsService } from '@/services/assets';
import { AssetTypesService } from '@/services/assetTypes';
import type { AssetType } from '@/services/assetTypes';
import { CustodiansService } from '@/services/custodians';
import type { Custodian } from '@/services/custodians';
import { GroupsService } from '@/services/groups';
import { TagsService } from '@/services/tags';
import type { Tag } from '@/services/tags';

import { CollapsibleSection } from '../ui/CollapsibleSection';

interface AddAssetFormProps {
    onClose: () => void;
    onSuccess?: () => void;
}

// Map icon strings to components
const iconMap: Record<string, React.ElementType> = {
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

// Helper to determine if quantity should be forced to 1
function shouldForceQuantityOne(assetType?: AssetType): boolean {
    if (!assetType) return false;
    const isAccount = assetType.name.includes('Account') || assetType.name.includes('Cash');
    const isReal = assetType.category === 'Real';
    return isAccount || isReal;
}

export function AddAssetForm({ onClose, onSuccess }: AddAssetFormProps) {
    const queryClient = useQueryClient();


    // Steps: 1 = Type Selection, 2 = Details
    const [step, setStep] = useState(1);

    const [showAddCustodian, setShowAddCustodian] = useState(false);
    const [showAddGroup, setShowAddGroup] = useState(false);
    const [showAddTag, setShowAddTag] = useState(false);

    const [formData, setFormData] = useState({
        name: '',
        ticker_symbol: '',
        quantity: '',
        purchase_price: '',
        currency: 'CHF',
        custodian_id: '',
        asset_type_id: '',
        is_favorite: false,
        custom_fields: {} as Record<string, string | number>,
        notes: '',
        purchase_date: new Date().toISOString().split('T')[0],
        group_id: '',
        tag_ids: [] as number[],
    });

    // Track if form is dirty
    const [isDirty, setIsDirty] = useState(false);

    const { data: assetTypes = [] } = useQuery({
        queryKey: ['asset-types'],
        queryFn: AssetTypesService.getAll,
    });

    const { data: custodians = [] } = useQuery({
        queryKey: ['custodians'],
        queryFn: CustodiansService.getAll,
    });

    const { data: groups = [] } = useQuery({
        queryKey: ['primary-groups'],
        queryFn: GroupsService.getAll,
    });

    const { data: tags = [] } = useQuery({
        queryKey: ['tags'],
        queryFn: TagsService.getAll,
    });

    const categories = useMemo(() => {
        const cats = new Set(assetTypes.map(t => t.category));
        return Array.from(cats);
    }, [assetTypes]);

    const selectedAssetType = assetTypes.find(t => t.id.toString() === formData.asset_type_id.toString());
    const category = selectedAssetType?.category || '';
    const isFinancial = category === 'Financial';
    const isReal = category === 'Real';
    const isLiability = category === 'Liability';
    const dynamicFields = selectedAssetType?.fields || [];
    const displayConfig = selectedAssetType?.display_config || {};

    const createAssetMutation = useMutation({
        mutationFn: AssetsService.create,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['assets'] });
            queryClient.invalidateQueries({ queryKey: ['portfolio-summary'] });
            onSuccess?.();
            onClose();
        },
    });

    const { data: settings } = useQuery({
        queryKey: ['settings'],
        queryFn: async () => {
            const response = await api.get('/settings');
            return response.data;
        },
        staleTime: 5 * 60 * 1000,
    });

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();

        const payload: Partial<Parameters<typeof AssetsService.create>[0]> & { custom_fields: Record<string, string | number> } = {
            name: formData.name,
            custodian_id: Number(formData.custodian_id),
            asset_type_id: Number(formData.asset_type_id),
            is_favorite: formData.is_favorite,
            custom_fields: formData.custom_fields || {},
        };

        if (formData.currency) payload.currency = formData.currency;
        if (formData.ticker_symbol) payload.ticker_symbol = formData.ticker_symbol;
        if (formData.notes) payload.notes = formData.notes;

        if (shouldForceQuantityOne(selectedAssetType)) {
            payload.quantity = 1;
        } else if (formData.quantity) {
            payload.quantity = parseFloat(formData.quantity);
        }

        if (formData.purchase_price) payload.purchase_price = parseFloat(formData.purchase_price);
        if (formData.purchase_date) payload.purchase_date = formData.purchase_date;

        if (formData.group_id) {
            payload.group_id = parseInt(formData.group_id);
        } else {
            payload.group_id = undefined;
        }

        if (formData.tag_ids) {
            payload.tag_ids = formData.tag_ids.map(id => Number(id));
        }

        createAssetMutation.mutate(payload as Parameters<typeof AssetsService.create>[0]);
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        setIsDirty(true);
        const { name, value, type } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : value,
        }));
    };

    const handleCustomFieldChange = (fieldName: string, value: string | number) => {
        setIsDirty(true);
        setFormData(prev => ({
            ...prev,
            custom_fields: {
                ...prev.custom_fields,
                [fieldName]: value
            }
        }));
    };

    return (
        <>
            <AddModal
                isOpen={true}
                onClose={onClose}
                hasUnsavedChanges={isDirty}
                className="max-w-2xl"
                title={
                    <div className="flex items-center gap-3">
                        {step === 2 && (
                            <button
                                onClick={() => setStep(1)}
                                className="p-1 hover:bg-muted rounded-full transition-colors"
                            >
                                <ArrowLeft className="h-5 w-5" />
                            </button>
                        )}
                        <span className="bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
                            {step === 1 ? 'Select Asset Type' : 'Asset Details'}
                        </span>
                    </div>
                }
                onSubmit={step === 1 ? (e) => e.preventDefault() : handleSubmit}
                submitLabel="Create Asset"
                isSubmitting={createAssetMutation.isPending}
            >
                {step === 1 ? (
                    <div className="space-y-6">
                        {categories.map(cat => (
                            <div key={cat} className="space-y-3">
                                <h3 className="font-medium text-sm text-muted-foreground uppercase tracking-wider pl-1">
                                    {cat}
                                </h3>
                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                                    {assetTypes.filter(t => t.category === cat).map(type => {
                                        const Icon = type.icon && iconMap[type.icon] ? iconMap[type.icon] : Box;
                                        return (
                                            <button
                                                key={type.id}
                                                type="button"
                                                onClick={() => {
                                                    setFormData(prev => ({ ...prev, asset_type_id: type.id.toString(), quantity: shouldForceQuantityOne(type) ? '1' : '' }));
                                                    setStep(2);
                                                }}
                                                className="flex flex-col items-center gap-3 p-4 rounded-xl border border-border/50 bg-card hover:border-primary/50 hover:bg-muted/50 transition-all text-center group"
                                            >
                                                <div className="p-3 bg-primary/10 rounded-full group-hover:scale-110 transition-transform text-primary">
                                                    <Icon className="h-6 w-6" />
                                                </div>
                                                <span className="font-medium text-sm">{type.name}</span>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="space-y-6 animate-slide-up">
                        {/* Basic Info - Always Visible */}
                        <div className="space-y-4 p-1">
                            <div>
                                <FormLabel required>Asset Name</FormLabel>
                                <input
                                    type="text"
                                    name="name"
                                    value={formData.name}
                                    onChange={handleChange}
                                    required
                                    className="w-full px-4 py-2 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all font-medium text-lg"
                                    placeholder="e.g. Apple Stock, Main Checking"
                                    autoFocus
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                {isFinancial && selectedAssetType?.name !== 'Exchange' && displayConfig.show_ticker !== false && (
                                    <div>
                                        <FormLabel>Ticker Symbol</FormLabel>
                                        <div className="relative">
                                            <input
                                                type="text"
                                                name="ticker_symbol"
                                                value={formData.ticker_symbol}
                                                onChange={handleChange}
                                                className="w-full px-4 py-2 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all uppercase font-mono"
                                                placeholder="AAPL"
                                            />
                                        </div>
                                    </div>
                                )}
                                {displayConfig.show_currency !== false && (
                                    <div>
                                        <FormLabel required>Currency</FormLabel>
                                        <div className="relative">
                                            <select
                                                name="currency"
                                                value={formData.currency}
                                                onChange={handleChange}
                                                required
                                                className="w-full pl-4 pr-10 py-2 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all font-mono appearance-none"
                                            >
                                                {(settings?.currencies && settings.currencies.length > 0 ? settings.currencies : ['USD', 'EUR', 'CHF', 'GBP']).map((c: string) => (
                                                    <option key={c} value={c}>{c}</option>
                                                ))}
                                            </select>
                                            <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-muted-foreground">
                                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6" /></svg>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Dynamic Fields Section */}
                        {dynamicFields.length > 0 && (
                            <CollapsibleSection title="Asset Details" defaultOpen={true}>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {dynamicFields.map(field => (
                                        <div key={field.name} className={field.type === 'text' && !field.options ? "col-span-1 md:col-span-2" : "col-span-1"}>
                                            <FormLabel required={field.required}>{field.name}</FormLabel>
                                            {field.type === 'select' && field.options ? (
                                                <select
                                                    value={formData.custom_fields[field.name] || ''}
                                                    onChange={(e) => handleCustomFieldChange(field.name, e.target.value)}
                                                    required={field.required}
                                                    className="w-full px-4 py-2 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all"
                                                >
                                                    <option value="">Select {field.name}...</option>
                                                    {field.options.map((opt: string) => (
                                                        <option key={opt} value={opt}>{opt}</option>
                                                    ))}
                                                </select>
                                            ) : field.type === 'date' ? (
                                                <DateInput
                                                    value={formData.custom_fields[field.name] ? new Date(formData.custom_fields[field.name]).toISOString().split('T')[0] : ''}
                                                    onChange={(e) => handleCustomFieldChange(field.name, e.target.value)}
                                                    required={field.required}
                                                />
                                            ) : (
                                                <div className="relative">
                                                    <input
                                                        type={field.type}
                                                        value={formData.custom_fields[field.name] || ''}
                                                        onChange={(e) => handleCustomFieldChange(field.name, e.target.value)}
                                                        required={field.required}
                                                        className={cn(
                                                            "w-full px-4 py-2 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all",
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
                            </CollapsibleSection>
                        )}

                        {/* Custody, Grouping & Tags Section */}
                        <CollapsibleSection
                            title="Tags & Grouping"
                            defaultOpen={!displayConfig.collapse_tags_default}
                        >
                            <div className="space-y-6">
                                <div className="space-y-4">
                                    <div>
                                        <FormLabel required={true}>
                                            {isLiability ? "Lender" : (isReal ? "Location / Owner" : "Custodian")}
                                        </FormLabel>
                                        <div className="flex gap-2">
                                            <select
                                                name="custodian_id"
                                                value={formData.custodian_id}
                                                onChange={handleChange}
                                                required
                                                className="w-full px-4 py-2 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all"
                                            >
                                                <option value="">
                                                    {isLiability ? "Select lender..." : (isReal ? "Select location..." : "Select custodian...")}
                                                </option>
                                                {custodians.map((custodian: Custodian) => (
                                                    <option key={custodian.id} value={custodian.id}>
                                                        {custodian.name} ({custodian.type})
                                                    </option>
                                                ))}
                                            </select>
                                            <button
                                                type="button"
                                                onClick={() => setShowAddCustodian(true)}
                                                className="p-2 border border-border rounded-lg hover:bg-muted transition-colors flex-shrink-0"
                                                title="Add New Custodian"
                                            >
                                                <Plus className="h-5 w-5" />
                                            </button>
                                        </div>
                                    </div>

                                    {/* Primary Group */}
                                    <div>
                                        <FormLabel>Primary Group</FormLabel>
                                        <div className="flex gap-2">
                                            <select
                                                name="group_id"
                                                value={formData.group_id}
                                                onChange={handleChange}
                                                className="w-full px-4 py-2 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all font-medium"
                                            >
                                                <option value="">No Group (Unallocated)</option>
                                                {groups.map((group: { id: number; name: string }) => (
                                                    <option key={group.id} value={group.id}>
                                                        {group.name}
                                                    </option>
                                                ))}
                                            </select>
                                            <button
                                                type="button"
                                                onClick={() => setShowAddGroup(true)}
                                                className="p-2 border border-border rounded-lg hover:bg-muted transition-colors flex-shrink-0"
                                                title="Add New Group"
                                            >
                                                <Plus className="h-5 w-5" />
                                            </button>
                                        </div>
                                    </div>
                                </div>

                                <div className="pt-4 border-t border-border/50">
                                    <div className="flex items-center justify-between mb-2">
                                        <FormLabel>Tags</FormLabel>
                                        <button
                                            type="button"
                                            onClick={() => setShowAddTag(true)}
                                            className="text-[10px] uppercase tracking-wider font-bold text-primary hover:text-primary/80 transition-colors flex items-center gap-1"
                                        >
                                            <Plus className="w-3 h-3" />
                                            New Tag
                                        </button>
                                    </div>
                                    <div className="flex flex-wrap gap-2 p-3 bg-background/50 rounded-xl border border-border/50">
                                        {tags.length > 0 ? (
                                            tags.map((tag: { id: number; name: string }) => (
                                                <button
                                                    key={tag.id}
                                                    type="button"
                                                    onClick={() => {
                                                        setIsDirty(true);
                                                        setFormData((prev) => ({
                                                            ...prev,
                                                            tag_ids: prev.tag_ids.includes(tag.id)
                                                                ? prev.tag_ids.filter((id: number) => id !== tag.id)
                                                                : [...prev.tag_ids, tag.id]
                                                        }));
                                                    }}
                                                    className={cn(
                                                        "px-3 py-1 rounded-full text-xs font-medium transition-all border",
                                                        formData.tag_ids.includes(tag.id)
                                                            ? "bg-primary/20 border-primary text-primary"
                                                            : "bg-background border-border text-muted-foreground hover:border-primary/50"
                                                    )}
                                                >
                                                    {tag.name}
                                                </button>
                                            ))
                                        ) : (
                                            <p className="text-xs text-muted-foreground italic">No tags defined yet.</p>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </CollapsibleSection>

                        {/* Purchase Details Section */}
                        {(displayConfig.show_quantity !== false || displayConfig.show_purchase_date !== false || displayConfig.show_unit_price !== false) && (
                            <CollapsibleSection title="Purchase & Value Data" defaultOpen={true}>
                                <div className="space-y-4">
                                    {displayConfig.show_purchase_date !== false && (
                                        <div>
                                            <FormLabel>Date</FormLabel>
                                            <DateInput
                                                value={formData.purchase_date}
                                                onChange={(e) => {
                                                    setFormData(prev => ({ ...prev, purchase_date: e.target.value }));
                                                    setIsDirty(true);
                                                }}
                                            />
                                        </div>
                                    )}

                                    <div className="grid grid-cols-2 gap-4">
                                        {displayConfig.show_quantity !== false && (
                                            <div>
                                                <FormLabel required>Quantity</FormLabel>
                                                {shouldForceQuantityOne(selectedAssetType) ? (
                                                    <div className="px-4 py-2 bg-muted/50 border border-border rounded-lg text-muted-foreground cursor-not-allowed">
                                                        1.00 (Fixed)
                                                    </div>
                                                ) : (
                                                    <input
                                                        type="number"
                                                        name="quantity"
                                                        value={formData.quantity}
                                                        onChange={handleChange}
                                                        required
                                                        step="any"
                                                        className="w-full px-4 py-2 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all"
                                                        placeholder="0.00"
                                                    />
                                                )}
                                            </div>
                                        )}
                                        {displayConfig.show_unit_price !== false && (
                                            <div>
                                                <FormLabel>
                                                    {isLiability ? "Loan Amount" : "Price per Unit"}
                                                </FormLabel>
                                                <CurrencyInput
                                                    value={formData.purchase_price}
                                                    onChange={(val) => {
                                                        setFormData(prev => ({ ...prev, purchase_price: val }));
                                                        setIsDirty(true);
                                                    }}
                                                    currency={formData.currency}
                                                    onCurrencyChange={(curr) => {
                                                        setFormData(prev => ({ ...prev, currency: curr }));
                                                        setIsDirty(true);
                                                    }}
                                                    currencyOptions={settings?.currencies && settings.currencies.length > 0 ? settings.currencies : ["CHF", "USD", "EUR"]}
                                                    placeholder="0.00"
                                                />
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </CollapsibleSection>
                        )}

                        {createAssetMutation.isError && (
                            <div className="p-4 bg-destructive/10 border border-destructive rounded-lg animate-fade-in">
                                <p className="text-sm text-destructive font-medium">
                                    Error saving asset. Please try again.
                                </p>
                            </div>
                        )}
                    </div>
                )}
            </AddModal>

            {/* Nested Modals */}
            {
                showAddCustodian && (
                    <AddCustodianForm
                        onClose={() => setShowAddCustodian(false)}
                        onSuccess={(newCustodian: Custodian) => {
                            setFormData(prev => ({ ...prev, custodian_id: newCustodian.id.toString() }));
                            setIsDirty(true);
                        }}
                    />
                )
            }

            {
                showAddGroup && (
                    <AddGroupForm
                        onClose={() => setShowAddGroup(false)}
                        onSuccess={(newGroup) => {
                            setFormData(prev => ({ ...prev, group_id: newGroup.id.toString() }));
                            setIsDirty(true);
                        }}
                    />
                )
            }

            {
                showAddTag && (
                    <AddTagForm
                        onClose={() => setShowAddTag(false)}
                        onSuccess={(data: Tag) => {
                            setFormData(prev => ({
                                ...prev,
                                tag_ids: [...prev.tag_ids, data.id]
                            }));
                            setIsDirty(true);
                        }}
                    />
                )
            }
        </>
    );
}
