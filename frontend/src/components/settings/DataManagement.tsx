
import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import api from '@/services/api';
import { Database, Download, Upload, Activity, FileJson, AlertTriangle } from 'lucide-react';
import { toast } from '@/services/toast';

export function DataManagement() {
    const queryClient = useQueryClient();
    const [selectedCategories, setSelectedCategories] = useState<string[]>(['settings', 'currencies', 'assets', 'transactions', 'custodians', 'asset_types', 'groups', 'tags', 'value_history']);
    const [isExporting, setIsExporting] = useState(false);
    const [importFile, setImportFile] = useState<File | null>(null);
    const [isImporting, setIsImporting] = useState(false);
    const [importResult, setImportResult] = useState<{ summary: Record<string, number>; errors: string[] } | null>(null);

    const { data: counts } = useQuery({
        queryKey: ['data-counts'],
        queryFn: async () => {
            const response = await api.get('/data/counts');
            return response.data;
        }
    });

    const categories = [
        { id: 'settings', label: 'App Configuration', count: counts?.settings },
        { id: 'currencies', label: 'Currencies', count: counts?.currencies },
        { id: 'assets', label: 'Assets', count: counts?.assets },
        { id: 'transactions', label: 'Transactions', count: counts?.transactions },
        { id: 'custodians', label: 'Custodians', count: counts?.custodians },
        { id: 'asset_types', label: 'Asset Types', count: counts?.asset_types },
        { id: 'groups', label: 'Primary Groups', count: counts?.groups },
        { id: 'tags', label: 'Tags', count: counts?.tags },
        { id: 'value_history', label: 'Value History', count: counts?.value_history },
    ];

    const toggleCategory = (id: string) => {
        setSelectedCategories(prev =>
            prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id]
        );
    };

    const toggleAll = () => {
        if (selectedCategories.length === categories.length) {
            setSelectedCategories([]);
        } else {
            setSelectedCategories(categories.map(c => c.id));
        }
    };

    const handleExport = async () => {
        setIsExporting(true);
        try {
            const params = new URLSearchParams();
            params.append('include', selectedCategories.join(','));

            const response = await api.get(`/data/export?${params.toString()}`);
            const blob = new Blob([JSON.stringify(response.data, null, 2)], { type: 'application/json' });
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `wealthpulse-export-${new Date().toISOString().split('T')[0]}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);
            toast.success("Export generated successfully.");
        } catch (error) {
            console.error('Export failed:', error);
            toast.error('Export failed. Please try again.');
        } finally {
            setIsExporting(false);
        }
    };

    const handleImport = async () => {
        if (!importFile) return;
        setIsImporting(true);
        setImportResult(null);

        const formData = new FormData();
        formData.append('file', importFile);

        try {
            const response = await api.post('/data/import', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            setImportResult(response.data);
            await queryClient.invalidateQueries({ queryKey: ['data-counts'] });
            toast.success('Import successful!');
            setImportFile(null);
        } catch (error) {
            console.error('Import failed:', error);
            toast.error('Import failed. Please check the file and try again.');
        } finally {
            setIsImporting(false);
        }
    };

    return (
        <div className="space-y-8 animate-slide-up">
            <h2 className="text-2xl font-semibold flex items-center gap-2">
                <Database className="h-6 w-6 text-primary" />
                Data Management
            </h2>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Export Section */}
                <div className="glass-card p-6 rounded-xl border border-white/10 space-y-6">
                    <div className="flex items-center gap-3 pb-4 border-b border-white/5">
                        <div className="p-2 rounded-full bg-blue-500/10 text-blue-500">
                            <Download className="h-5 w-5" />
                        </div>
                        <div>
                            <h3 className="font-semibold text-lg">Export Data</h3>
                            <p className="text-sm text-muted-foreground">Select data categories to export to JSON</p>
                        </div>
                        <button
                            onClick={toggleAll}
                            className="ml-auto text-xs font-medium text-primary hover:underline"
                        >
                            {selectedCategories.length === categories.length ? 'Deselect All' : 'Select All'}
                        </button>
                    </div>

                    <div className="space-y-3">
                        {categories.map(cat => (
                            <label key={cat.id} className="flex items-center justify-between p-3 rounded-lg hover:bg-white/5 cursor-pointer border border-transparent hover:border-white/5 transition-all">
                                <div className="flex items-center gap-3">
                                    <input
                                        type="checkbox"
                                        className="rounded border-white/20 bg-black/20 text-primary focus:ring-primary"
                                        checked={selectedCategories.includes(cat.id)}
                                        onChange={() => toggleCategory(cat.id)}
                                    />
                                    <span className="font-medium">{cat.label}</span>
                                </div>
                                <span className="text-xs font-mono py-1 px-2 rounded-full bg-white/5 text-muted-foreground">
                                    {cat.count !== undefined ? cat.count : '-'} records
                                </span>
                            </label>
                        ))}
                    </div>

                    <button
                        onClick={handleExport}
                        disabled={isExporting || selectedCategories.length === 0}
                        className="w-full flex items-center justify-center gap-2 py-3 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-all disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                    >
                        {isExporting ? <Activity className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                        {isExporting ? 'Exporting...' : 'Export Selected Data'}
                    </button>
                </div>

                {/* Import Section */}
                <div className="glass-card p-6 rounded-xl border border-white/10 space-y-6">
                    <div className="flex items-center gap-3 pb-4 border-b border-white/5">
                        <div className="p-2 rounded-full bg-emerald-500/10 text-emerald-500">
                            <Upload className="h-5 w-5" />
                        </div>
                        <div>
                            <h3 className="font-semibold text-lg">Import Data</h3>
                            <p className="text-sm text-muted-foreground">Restore data from a JSON backup file</p>
                        </div>
                    </div>

                    <div className="border-2 border-dashed border-white/10 rounded-xl p-8 text-center hover:bg-white/5 transition-colors relative">
                        <input
                            type="file"
                            accept=".json"
                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                            onChange={(e) => setImportFile(e.target.files?.[0] || null)}
                        />
                        <div className="flex flex-col items-center gap-2 pointer-events-none">
                            <FileJson className="h-8 w-8 text-muted-foreground mb-2" />
                            {importFile ? (
                                <>
                                    <p className="font-medium text-emerald-400">{importFile.name}</p>
                                    <p className="text-xs text-muted-foreground">{(importFile.size / 1024).toFixed(1)} KB</p>
                                </>
                            ) : (
                                <>
                                    <p className="font-medium">Click or Drag JSON file here</p>
                                    <p className="text-xs text-muted-foreground">Supports WealthPulse Export format</p>
                                </>
                            )}
                        </div>
                    </div>

                    {importFile && (
                        <div className="p-4 rounded-lg bg-yellow-500/5 border border-yellow-500/20 text-xs text-yellow-200/80">
                            <p className="font-semibold mb-1 flex items-center gap-1"><AlertTriangle className="h-3 w-3" /> Warning</p>
                            Existing records with matching names may be updated. New records will be created. Please verify your file source.
                        </div>
                    )}

                    {importResult && (
                        <div className="p-4 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-200">
                            <p className="font-semibold mb-2">Import Complete</p>
                            <div className="grid grid-cols-2 gap-2">
                                {Object.entries(importResult.summary).map(([key, val]) => (
                                    <div key={key} className="flex justify-between">
                                        <span className="capitalize">{key.replace('_', ' ')}:</span>
                                        <span className="font-mono">{val}</span>
                                    </div>
                                ))}
                            </div>
                            {importResult.errors?.length > 0 && (
                                <div className="mt-2 text-red-400">
                                    <p className="font-semibold">Errors:</p>
                                    <ul className="list-disc pl-4 mt-1">
                                        {importResult.errors.slice(0, 3).map((e, i) => <li key={i}>{e}</li>)}
                                        {importResult.errors.length > 3 && <li>...and {importResult.errors.length - 3} more</li>}
                                    </ul>
                                </div>
                            )}
                        </div>
                    )}

                    <button
                        onClick={handleImport}
                        disabled={isImporting || !importFile}
                        className="w-full flex items-center justify-center gap-2 py-3 bg-emerald-600 text-white rounded-lg hover:bg-emerald-500 transition-all disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                    >
                        {isImporting ? <Activity className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                        {isImporting ? 'Importing...' : 'Start Import'}
                    </button>
                </div>
            </div>
        </div>
    );
}
