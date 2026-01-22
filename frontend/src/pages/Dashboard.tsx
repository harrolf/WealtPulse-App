import { useState } from 'react';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import api from '@/services/api';
import { useSettingsContext } from '@/contexts/SettingsContext';
import type { PortfolioSummary, PerformanceData, PerformanceAdvanced } from '@/types/dashboard';

// Imported Sub-components
import { DashboardHeader } from '@/components/dashboard/DashboardHeader';
import { NetWorthCard } from '@/components/dashboard/NetWorthCard';
import { PerformanceSection } from '@/components/dashboard/PerformanceSection';
import { StatsOverview } from '@/components/dashboard/StatsOverview';
import { AssetAllocationSection } from '@/components/dashboard/AssetAllocationSection';
import { HistoricalPill } from '@/components/dashboard/HistoricalPill';

export function Dashboard() {
    const { settings } = useSettingsContext();
    const [dateRange, setDateRange] = useState<{ start: string, end: string, label: string }>({
        start: new Date(new Date().setDate(new Date().getDate() - 30)).toISOString().split('T')[0],
        end: "",
        label: "1m"
    });
    const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
    const [allocationViewMode, setAllocationViewMode] = useState<
        "category" | "type" | "currency" | "custodian" | "group" | "tag"
    >("type"); // Default to Type

    const handleTimeframeChange = (timeframe: string) => {
        if (timeframe === 'custom') return; // Custom handled separately

        const today = new Date(); // Define today here
        const end = ""; // Empty implies "Live/Today" to avoid isHistorical check
        let start = "";

        if (timeframe === '1d') start = new Date(new Date().setDate(today.getDate() - 1)).toISOString().split('T')[0];
        else if (timeframe === '1w') start = new Date(new Date().setDate(today.getDate() - 7)).toISOString().split('T')[0];
        else if (timeframe === '1m') start = new Date(new Date().setMonth(today.getMonth() - 1)).toISOString().split('T')[0];
        else if (timeframe === '3m') start = new Date(new Date().setMonth(today.getMonth() - 3)).toISOString().split('T')[0];
        else if (timeframe === 'ytd') start = new Date(today.getFullYear(), 0, 1).toISOString().split('T')[0];
        else if (timeframe === '1y') start = new Date(new Date().setFullYear(today.getFullYear() - 1)).toISOString().split('T')[0];
        else if (timeframe === 'all') start = "2000-01-01"; // Mock all time start

        setDateRange({ start, end, label: timeframe });
    };

    const handleDateStep = (direction: 'back' | 'forward') => {
        const currentEnd = dateRange.end ? new Date(dateRange.end) : new Date();
        const newDate = new Date(currentEnd);

        if (direction === 'back') {
            newDate.setDate(newDate.getDate() - 1);
        } else {
            newDate.setDate(newDate.getDate() + 1);
            // Don't allow future
            if (newDate > new Date()) return;
        }

        const dateStr = newDate.toISOString().split('T')[0];
        const isToday = dateStr === new Date().toISOString().split('T')[0];

        setDateRange(prev => ({
            ...prev,
            end: isToday ? "" : dateStr,
            label: 'custom'
        }));
    };

    const { data: summary, isLoading } = useQuery({
        queryKey: ['portfolio-summary', dateRange.end],
        queryFn: async () => {
            const params = dateRange.end ? { date: dateRange.end } : {};
            const response = await api.get('/portfolio/summary', { params });
            return response.data as PortfolioSummary;
        },
        placeholderData: keepPreviousData,
    });

    const { data: performance } = useQuery<PerformanceData>({
        queryKey: ['portfolio-performance', dateRange],
        queryFn: async () => {
            const response = await api.get('/portfolio/performance/summary', {
                params: {
                    start_date: dateRange.start,
                    end_date: dateRange.end
                }
            });
            return response.data;
        },
        enabled: !!dateRange, // Only run if we have initialized defaults
        placeholderData: keepPreviousData,
    });

    const { data: performanceDetail, isLoading: isPerfLoading } = useQuery<PerformanceAdvanced>({
        queryKey: ['performance-detail', dateRange],
        queryFn: async () => {
            const response = await api.get('/portfolio/performance/detail', {
                params: {
                    time_range: dateRange.label
                }
            });
            return response.data;
        },
        placeholderData: keepPreviousData
    });

    const { data: portfolioAllocation } = useQuery({
        queryKey: ['portfolio-allocation', dateRange.end],
        queryFn: async () => {
            const params = dateRange.end ? { date: dateRange.end } : {};
            const response = await api.get('/portfolio/allocation', { params });
            return response.data;
        },
        placeholderData: keepPreviousData,
    });

    // Use assets from summary instead of separate API call
    const assets = summary?.assets || [];

    // Filter assets for drill down
    const filteredAssets = selectedCategory ? assets.filter(asset => {
        const assetMatch =
            allocationViewMode === "category"
                ? asset.category === selectedCategory
                : allocationViewMode === "type"
                    ? asset.type === selectedCategory
                    : allocationViewMode === "currency"
                        ? asset.asset_currency === selectedCategory
                        : allocationViewMode === "custodian"
                            ? asset.custodian === selectedCategory
                            : allocationViewMode === "group"
                                ? asset.primary_group === selectedCategory
                                : allocationViewMode === "tag"
                                    ? asset.tags.includes(selectedCategory)
                                    : true;

        return assetMatch;
    }) : [];

    if (isLoading && !summary) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="flex items-center gap-3">
                    <div className="w-2 h-2 bg-primary rounded-full animate-pulse"></div>
                    <div className="w-2 h-2 bg-primary rounded-full animate-pulse delay-75"></div>
                    <div className="w-2 h-2 bg-primary rounded-full animate-pulse delay-150"></div>
                </div>
            </div>
        );
    }

    const isHistorical = summary?.is_historical;

    return (
        <div className="space-y-8 animate-fade-in">
            {/* Header with Date Controls */}
            <DashboardHeader
                dateRange={dateRange}
                setDateRange={setDateRange}
                handleTimeframeChange={handleTimeframeChange}
                handleDateStep={handleDateStep}
            />

            {/* Main Layout Grid */}
            <div className="space-y-6">

                {/* Row 1: Net Worth and Performance Chart */}
                <NetWorthCard
                    summary={summary}
                    performanceDetail={performanceDetail}
                    isHistorical={isHistorical}
                    settings={settings}
                    isPerfLoading={isPerfLoading}
                />

                {/* Row 2: Performance Stats */}
                <PerformanceSection
                    performance={performance}
                    summary={summary}
                    settings={settings}
                />

                {/* Row 3: Stats Breakdown Grid */}
                <StatsOverview
                    performance={performance}
                    performanceDetail={performanceDetail}
                    summary={summary}
                    settings={settings}
                />

                {/* Row 4: Asset Allocation & Drill Down */}
                <AssetAllocationSection
                    portfolioAllocation={portfolioAllocation}
                    summary={summary}
                    settings={settings}
                    selectedCategory={selectedCategory}
                    setSelectedCategory={setSelectedCategory}
                    allocationViewMode={allocationViewMode}
                    setAllocationViewMode={setAllocationViewMode}
                    filteredAssets={filteredAssets}
                />
            </div>

            {/* Historical Mode Floating Pill */}
            <HistoricalPill
                isHistorical={isHistorical}
                date={summary?.date}
                onReturnToPresent={() => handleTimeframeChange('1m')}
            />
        </div>
    );
}



