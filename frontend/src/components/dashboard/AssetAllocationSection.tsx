import { Sparkles, Layers } from 'lucide-react';
import { cn, formatCurrency } from '@/lib/utils';
import { AssetAllocationChart } from '@/components/charts/AssetAllocationChart';
import type { PortfolioSummary, AssetSummaryItem, PortfolioAllocation } from '@/types/dashboard';
import type { Settings } from '@/types/settings';
import { getCustodianIcon } from '@/utils/dashboardUtils';

interface AssetAllocationSectionProps {
    portfolioAllocation: PortfolioAllocation;
    summary?: PortfolioSummary;
    settings: Settings;
    selectedCategory: string | null;
    setSelectedCategory: (category: string | null) => void;
    allocationViewMode: "category" | "type" | "currency" | "custodian" | "group" | "tag";
    setAllocationViewMode: (mode: "category" | "type" | "currency" | "custodian" | "group" | "tag") => void;
    filteredAssets: AssetSummaryItem[];
}

export function AssetAllocationSection({
    portfolioAllocation,
    summary,
    settings,
    selectedCategory,
    setSelectedCategory,
    allocationViewMode,
    setAllocationViewMode,
    filteredAssets
}: AssetAllocationSectionProps) {

    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Allocation Chart */}
            <div className="relative overflow-hidden rounded-xl p-6 glass-strong animate-slide-up" style={{ animationDelay: '0.6s' }}>
                <div className="flex items-center gap-3 mb-6">
                    <div className="p-3 rounded-xl bg-primary/10">
                        <Sparkles className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                        <h3 className="text-lg font-bold text-foreground">Asset Allocation</h3>
                        <p className="text-xs text-muted-foreground">Distribution by {allocationViewMode === 'type' ? 'Type' : allocationViewMode === 'category' ? 'Category' : allocationViewMode === 'currency' ? 'Currency' : allocationViewMode === 'custodian' ? 'Custodian' : allocationViewMode === 'group' ? 'Primary Group' : 'Tag'}</p>
                    </div>
                </div>
                <AssetAllocationChart
                    data={{
                        by_category: portfolioAllocation?.by_category || [],
                        by_asset_type: portfolioAllocation?.by_asset_type || [],
                        by_currency: portfolioAllocation?.by_currency || [],
                        by_custodian: portfolioAllocation?.by_custodian || [],
                        by_group: portfolioAllocation?.by_group || [],
                        by_tag: portfolioAllocation?.by_tag || []
                    }}
                    onSelect={setSelectedCategory}
                    selectedCategory={selectedCategory}
                    viewMode={allocationViewMode}
                    onViewModeChange={(mode) => {
                        setAllocationViewMode(mode);
                        setSelectedCategory(null); // Clear selection when switching modes
                    }}
                    currency={summary?.main_currency}
                />
            </div>

            {/* Drill Down Details */}
            <div className={cn(
                "relative overflow-hidden rounded-xl p-6 glass-strong animate-slide-up transition-all duration-500",
                selectedCategory ? "opacity-100 translate-y-0" : "opacity-50 translate-y-4 pointer-events-none grayscale"
            )} style={{ animationDelay: '0.7s' }}>
                <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-3">
                        <div className="p-3 rounded-xl bg-secondary/20">
                            <Sparkles className="h-5 w-5 text-secondary-foreground" />
                        </div>
                        <div>
                            <h3 className="text-lg font-bold text-foreground">
                                {selectedCategory || "Select a Segment"}
                            </h3>
                            <p className="text-xs text-muted-foreground">
                                {allocationViewMode === 'type' ? 'Type Details' : allocationViewMode === 'currency' ? 'Currency Holdings' : allocationViewMode === 'custodian' ? 'Custodian Holdings' : allocationViewMode === 'group' ? 'Group Details' : allocationViewMode === 'tag' ? 'Tag Details' : 'Category Details'}
                            </p>
                        </div>
                    </div>
                    {selectedCategory && (
                        <button onClick={() => setSelectedCategory(null)} className="text-xs text-muted-foreground hover:text-foreground">
                            Clear
                        </button>
                    )}
                </div>

                {selectedCategory ? (
                    <div className="space-y-4 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                        {filteredAssets.length > 0 ? (
                            <table className="w-full text-sm">
                                <thead className="text-xs text-muted-foreground uppercase sticky top-0 bg-background/50 backdrop-blur-sm">
                                    <tr>
                                        <th className="text-left py-2 font-medium">Asset</th>
                                        <th className="text-right py-2 font-medium">Value</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-border/30">
                                    {filteredAssets.map(asset => {
                                        const val = asset.value;
                                        const AssetIcon = Layers;
                                        const CustodianIcon = getCustodianIcon(asset.custodian);

                                        return (
                                            <tr key={asset.id} className="group hover:bg-muted/10 transition-colors">
                                                <td className="py-2.5">
                                                    <div className="flex items-center gap-3">
                                                        <div className="flex -space-x-1 shrink-0">
                                                            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center ring-2 ring-background z-10" title={asset.type}>
                                                                <AssetIcon className="h-4 w-4 text-primary" />
                                                            </div>
                                                            <div className="w-8 h-8 rounded-full bg-secondary/20 flex items-center justify-center ring-2 ring-background" title={asset.custodian}>
                                                                <CustodianIcon className="h-4 w-4 text-secondary-foreground" />
                                                            </div>
                                                        </div>
                                                        <div>
                                                            <div className="text-sm font-medium group-hover:text-primary transition-colors">{asset.name}</div>
                                                            <div className="text-xs text-muted-foreground flex items-center gap-1.5">
                                                                <span>{Number(asset.quantity).toFixed(2)}</span>
                                                                <span className="w-1 h-1 rounded-full bg-border" />
                                                                <span className="opacity-80">{asset.custodian}</span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="text-right py-2.5 font-mono">
                                                    {formatCurrency(val, summary?.main_currency || 'CHF', 2, settings.number_format)}
                                                </td>
                                            </tr>
                                        )
                                    })}
                                </tbody>
                                <tfoot className="border-t border-border/50">
                                    <tr>
                                        <td className="py-3 font-semibold">Total</td>
                                        <td className="text-right py-3 font-bold text-primary">
                                            {formatCurrency(filteredAssets.reduce((acc, a) => acc + Number(a.value), 0), summary?.main_currency || 'CHF', 2, settings.number_format)}
                                        </td>
                                    </tr>
                                </tfoot>
                            </table>
                        ) : (
                            <div className="py-8 text-center text-muted-foreground text-sm">
                                No assets found in this category.
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="h-[200px] flex flex-col items-center justify-center text-muted-foreground text-center p-4">
                        <Sparkles className="h-8 w-8 mb-3 opacity-20" />
                        <p className="text-sm">Click on a pie slice to view breakdown</p>
                    </div>
                )}
            </div>
        </div>
    );
}
