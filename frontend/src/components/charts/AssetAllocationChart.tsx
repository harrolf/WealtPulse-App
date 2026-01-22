import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import { cn, formatCurrency } from '@/lib/utils';
import { useSettingsContext } from '@/contexts/SettingsContext';
import type { Settings } from '@/types/settings';

interface CustomTooltipProps {
    active?: boolean;
    payload?: { payload: { name: string; value: number } }[];
    currency: string;
    settings: Settings;
}

const CustomTooltip = ({ active, payload, currency, settings }: CustomTooltipProps) => {
    if (active && payload && payload.length) {
        const data = payload[0].payload;
        return (
            <div className="glass-strong p-3 rounded-lg border border-border/50 shadow-xl">
                <p className="font-bold text-foreground mb-1">{data.name}</p>
                <p className="text-primary font-mono">
                    {formatCurrency(data.value, currency, 2, settings.number_format)}
                </p>
            </div>
        );
    }
    return null;
};

const COLORS = ['#10b981', '#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b', '#6366f1'];

interface AssetAllocationChartProps {
    data: {
        by_category: { name: string; value: number }[];
        by_asset_type: { name: string; value: number }[];
        by_currency: { name: string; value: number }[];
        by_custodian: { name: string; value: number }[];
        by_group: { name: string; value: number }[];
        by_tag: { name: string; value: number }[];
    };
    onSelect: (category: string | null) => void;
    selectedCategory: string | null;
    viewMode: "category" | "type" | "currency" | "custodian" | "group" | "tag";
    onViewModeChange: (mode: "category" | "type" | "currency" | "custodian" | "group" | "tag") => void;
    currency?: string;
}

export function AssetAllocationChart({
    data,
    onSelect,
    selectedCategory,
    viewMode,
    onViewModeChange,
    currency = 'CHF'
}: AssetAllocationChartProps) {
    const { settings } = useSettingsContext();

    const rawData =
        viewMode === "category"
            ? data.by_category
            : viewMode === "type"
                ? data.by_asset_type
                : viewMode === "currency"
                    ? data.by_currency
                    : viewMode === "custodian"
                        ? data.by_custodian
                        : viewMode === "group"
                            ? data.by_group
                            : data.by_tag || [];

    // Sort by value descending
    const activeData = [...rawData]
        .map(item => ({ ...item, value: Number(item.value || 0) }))
        .sort((a, b) => b.value - a.value);

    // Filter out zero values
    // const filteredActiveData = activeData ? activeData.filter((d) => d.value > 0) : [];



    return (
        <div className="flex flex-col h-full max-h-[500px]">
            {/* Controls */}
            <div className="flex justify-center mb-4">
                <div className="bg-muted/30 p-1 rounded-lg flex items-center gap-1 scale-90">
                    <button
                        onClick={() => onViewModeChange("type")}
                        className={cn(
                            "px-3 py-1 rounded-full text-xs font-medium transition-colors",
                            viewMode === "type"
                                ? "bg-primary text-primary-foreground"
                                : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
                        )}
                    >
                        Type
                    </button>
                    <button
                        onClick={() => onViewModeChange("custodian")}
                        className={cn(
                            "px-3 py-1 rounded-full text-xs font-medium transition-colors",
                            viewMode === "custodian"
                                ? "bg-primary text-primary-foreground"
                                : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
                        )}
                    >
                        Custodian
                    </button>
                    <button
                        onClick={() => onViewModeChange("currency")}
                        className={cn(
                            "px-3 py-1 rounded-full text-xs font-medium transition-colors",
                            viewMode === "currency"
                                ? "bg-primary text-primary-foreground"
                                : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
                        )}
                    >
                        Currency
                    </button>
                    <button
                        onClick={() => onViewModeChange("category")}
                        className={cn(
                            "px-3 py-1 rounded-full text-xs font-medium transition-colors",
                            viewMode === "category"
                                ? "bg-primary text-primary-foreground"
                                : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
                        )}
                    >
                        Category
                    </button>
                    <button
                        onClick={() => onViewModeChange("group")}
                        className={cn(
                            "px-3 py-1 rounded-full text-xs font-medium transition-colors",
                            viewMode === "group"
                                ? "bg-primary text-primary-foreground"
                                : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
                        )}
                    >
                        Group
                    </button>
                    <button
                        onClick={() => onViewModeChange("tag")}
                        className={cn(
                            "px-3 py-1 rounded-full text-xs font-medium transition-colors",
                            viewMode === "tag"
                                ? "bg-primary text-primary-foreground"
                                : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
                        )}
                    >
                        Tag
                    </button>
                </div>
            </div>

            <div className="flex flex-1 gap-4 overflow-hidden">
                {/* Chart Area */}
                <div className="flex-1 min-h-[250px] relative">
                    {activeData.length === 0 ? (
                        <div className="absolute inset-0 flex items-center justify-center text-muted-foreground">
                            No data available
                        </div>
                    ) : (
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={activeData}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={60}
                                    outerRadius={80}
                                    paddingAngle={2}
                                    dataKey="value"
                                >
                                    {activeData.map((entry: { name: string; value: number }, index: number) => (
                                        <Cell
                                            key={`cell-${index}`}
                                            fill={COLORS[index % COLORS.length]}
                                            stroke={selectedCategory === entry.name ? "currentColor" : "none"}
                                            strokeWidth={selectedCategory === entry.name ? 2 : 0}
                                            className="cursor-pointer hover:opacity-80 transition-opacity"
                                            onClick={() => onSelect && onSelect(entry.name)}
                                        />
                                    ))}
                                </Pie>
                                <Tooltip content={<CustomTooltip currency={currency} settings={settings} />} />
                            </PieChart>
                        </ResponsiveContainer>
                    )}
                    {/* Center Text */}
                    {activeData.length > 0 && (
                        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-center pointer-events-none">
                            <p className="text-xs text-muted-foreground uppercase tracking-widest font-medium">Total</p>
                        </div>
                    )}
                </div>

                {/* Legend - Right Side */}
                <div className="w-[40%] flex flex-col justify-center border-l border-border/40 pl-4">
                    <div className="max-h-[250px] overflow-y-auto pr-2 custom-scrollbar">
                        <div className="grid grid-cols-1 gap-y-3">
                            {activeData.map((entry: { name: string; value: number }, index: number) => (
                                <div
                                    key={entry.name}
                                    className={cn(
                                        "flex items-center gap-2 text-xs cursor-pointer hover:bg-muted/50 p-1 rounded transition-colors",
                                        selectedCategory === entry.name && "bg-muted font-medium ring-1 ring-border"
                                    )}
                                    onClick={() => onSelect && onSelect(entry.name)}
                                >
                                    <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: COLORS[index % COLORS.length] }}></div>
                                    <div className="flex-1 min-w-0">
                                        <div className="truncate text-muted-foreground" title={entry.name}>{entry.name}</div>
                                        <div className="font-medium text-foreground tabular-nums">
                                            {(() => {
                                                const total = activeData.reduce((acc: number, curr: { value: number }) => acc + Number(curr.value), 0);
                                                const percent = total > 0 ? (Number(entry.value) / total) * 100 : 0;
                                                return percent.toFixed(0);
                                            })()}%
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
