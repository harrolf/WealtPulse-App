import React, { useState } from "react";
import {
    LineChart,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    Area,
    AreaChart,
    Legend
} from "recharts";

import { formatCurrency } from '@/lib/utils';
import { useSettingsContext } from '@/contexts/SettingsContext';
import { useFormattedDateTime } from '@/utils/datetime';

import type { TWRSeriesPoint } from '@/types/dashboard';

interface PerformanceChartProps {
    data: TWRSeriesPoint[];
    isLoading: boolean;
    mainCurrency: string;
}

export const PerformanceChart: React.FC<PerformanceChartProps> = ({
    data,
    isLoading,
    mainCurrency,
}) => {
    const { settings } = useSettingsContext();
    const { formatDate } = useFormattedDateTime();
    const [viewMode, setViewMode] = useState<"twr" | "mwr">("twr"); // twr = Strategy, mwr = Growth

    if (isLoading) {
        return (
            <div className="h-full w-full flex items-center justify-center bg-white/50 backdrop-blur-sm rounded-xl">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
            </div>
        );
    }

    if (!data || data.length === 0) {
        return (
            <div className="h-full w-full flex items-center justify-center text-slate-400">
                No performance data available
            </div>
        );
    }

    // Pre-process data for TWR to Percentage
    const chartData = data.map(d => ({
        ...d,
        twr_percent: (d.value - 1) * 100,
        format_date: formatDate(d.date, { month: 'short', day: 'numeric' })
    }));

    return (
        <div className="w-full h-full flex flex-col">
            <div className="flex justify-between items-center mb-4 px-2">
                <h3 className="text-sm font-medium text-slate-700">
                    {viewMode === "twr" ? "Cumulative Return (TWR)" : "Portfolio Growth vs. Invested"}
                </h3>

                <div className="bg-slate-100 p-1 rounded-lg flex gap-1">
                    <button
                        onClick={() => setViewMode("twr")}
                        className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${viewMode === "twr"
                            ? "bg-white text-indigo-600 shadow-sm"
                            : "text-slate-500 hover:text-slate-700"
                            }`}
                    >
                        Strategy %
                    </button>
                    <button
                        onClick={() => setViewMode("mwr")}
                        className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${viewMode === "mwr"
                            ? "bg-white text-indigo-600 shadow-sm"
                            : "text-slate-500 hover:text-slate-700"
                            }`}
                    >
                        Growth $
                    </button>
                </div>
            </div>

            <div className="flex-1 min-h-0">
                <ResponsiveContainer width="100%" height="100%">
                    {viewMode === "twr" ? (
                        <AreaChart data={chartData}>
                            <defs>
                                <linearGradient id="colorTwr" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.2} />
                                    <stop offset="95%" stopColor="#4f46e5" stopOpacity={0} />
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                            <XAxis
                                dataKey="format_date"
                                stroke="#94a3b8"
                                fontSize={12}
                                tickLine={false}
                                axisLine={false}
                                minTickGap={30}
                            />
                            <YAxis
                                stroke="#94a3b8"
                                fontSize={12}
                                tickLine={false}
                                axisLine={false}
                                tickFormatter={(val) => `${val.toFixed(1)}%`}
                            />
                            <Tooltip
                                contentStyle={{ borderRadius: "8px", border: "none", boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)" }}
                                formatter={(value: number | string | undefined) => {
                                    const val = Number(value);
                                    return [`${isNaN(val) ? '0.00' : val.toFixed(2)}%`, "Return"];
                                }}
                                labelStyle={{ color: "#64748b", marginBottom: "0.25rem" }}
                            />
                            <Area
                                type="monotone"
                                dataKey="twr_percent"
                                stroke="#4f46e5"
                                strokeWidth={2}
                                fillOpacity={1}
                                fill="url(#colorTwr)"
                            />
                        </AreaChart>
                    ) : (
                        <LineChart data={chartData}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                            <XAxis
                                dataKey="format_date"
                                stroke="#94a3b8"
                                fontSize={12}
                                tickLine={false}
                                axisLine={false}
                                minTickGap={30}
                            />
                            <YAxis
                                stroke="#94a3b8"
                                fontSize={12}
                                tickLine={false}
                                axisLine={false}
                                tickFormatter={(val) => val >= 1000 ? `${(val / 1000).toFixed(0)}k` : `${val}`}
                            />
                            <Tooltip
                                contentStyle={{ borderRadius: "8px", border: "none", boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)" }}
                                formatter={(value: number | string | undefined, name: string | number | undefined) => {
                                    const val = Number(value);
                                    return [
                                        formatCurrency(isNaN(val) ? 0 : val, mainCurrency, 0, settings.number_format),
                                        String(name)
                                    ];
                                }}
                                labelStyle={{ color: "#64748b", marginBottom: "0.25rem" }}
                            />
                            <Legend iconType="circle" wrapperStyle={{ paddingTop: "10px" }} />
                            <Line
                                type="monotone"
                                dataKey="portfolio_value"
                                name="Portfolio Value"
                                stroke="#4f46e5"
                                strokeWidth={2}
                                dot={false}
                                activeDot={{ r: 4 }}
                            />
                            <Line
                                type="stepAfter"
                                dataKey="net_invested_cumulative"
                                name="Net Invested"
                                stroke="#94a3b8"
                                strokeWidth={2}
                                strokeDasharray="4 4"
                                dot={false}
                            />
                        </LineChart>
                    )}
                </ResponsiveContainer>
            </div>
        </div>
    );
};
