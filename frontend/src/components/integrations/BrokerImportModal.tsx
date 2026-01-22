import { useState } from 'react';
import { Upload, FileText, TrendingUp, DollarSign, AlertCircle, CheckCircle2, X, Building2, Loader2 } from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { IntegrationsService, type BrokerImportSummary } from '@/services/integrations';
import { toast } from '@/services/toast';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { cn } from '@/lib/utils';

interface BrokerImportModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export function BrokerImportModal({ isOpen, onClose }: BrokerImportModalProps) {
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [summary, setSummary] = useState<BrokerImportSummary | null>(null);
    const [dragActive, setDragActive] = useState(false);
    const [selectedBroker, setSelectedBroker] = useState<string | null>(null);
    const [detectedBroker, setDetectedBroker] = useState<string | null>(null);
    const [skipClosedPositions, setSkipClosedPositions] = useState(true);
    const [simplifiedImport, setSimplifiedImport] = useState(false);

    const [importResult, setImportResult] = useState<{ imported: number, skipped: number, assets_created: number } | null>(null);
    const queryClient = useQueryClient();

    // Fetch supported brokers
    const { data: brokersData } = useQuery({
        queryKey: ['supported-brokers'],
        queryFn: IntegrationsService.getSupportedBrokers,
        enabled: isOpen,
    });

    const uploadMutation = useMutation({
        mutationFn: ({ file, broker, skipClosedPositions, simplifiedImport }: { file: File; broker?: string, skipClosedPositions: boolean, simplifiedImport: boolean }) =>
            IntegrationsService.uploadFile(file, broker, skipClosedPositions, simplifiedImport),
        onSuccess: (data) => {
            setSummary(data);
            setDetectedBroker(data.broker);
            toast.success(`${data.broker.replace('_', ' ').toUpperCase()} file parsed successfully!`);
        },
        onError: (error: Error & { response?: { data?: { detail?: string } } }) => {
            toast.error(error.response?.data?.detail || 'Failed to parse file');
        },
    });

    const detectMutation = useMutation({
        mutationFn: IntegrationsService.detectBroker,
        onSuccess: (data) => {
            setDetectedBroker(data.detected_broker);
            if (!data.supported) {
                toast.warning(`${data.detected_broker.replace('_', ' ').toUpperCase()} detected but not yet supported`);
            }
        },
    });

    const importMutation = useMutation({
        mutationFn: ({ file, broker, skipClosedPositions, simplifiedImport }: { file: File, broker?: string, skipClosedPositions: boolean, simplifiedImport: boolean }) =>
            IntegrationsService.importTransactions(file, broker, skipClosedPositions, simplifiedImport),
        onSuccess: (result) => {
            setImportResult(result);
            toast.success(`Successfully imported ${result.imported} transactions!`);
            queryClient.invalidateQueries({ queryKey: ['assets'] });
            queryClient.invalidateQueries({ queryKey: ['portfolio-summary'] });
        },
        onError: (error: Error & { response?: { data?: { detail?: string } } }) => {
            toast.error(error.response?.data?.detail || 'Failed to import transactions');
        },
    });

    const handleFileSelect = (file: File) => {
        const allowedExtensions = ['.csv', '.xlsx', '.xls', '.pdf'];
        const fileExtension = file.name.toLowerCase().substring(file.name.lastIndexOf('.'));

        if (!allowedExtensions.includes(fileExtension)) {
            toast.error('Please select a CSV, Excel (XLSX), or PDF file');
            return;
        }

        setSelectedFile(file);
        setSummary(null);

        // Detect broker type first
        detectMutation.mutate(file);

        // Then upload and parse
        uploadMutation.mutate({
            file,
            broker: selectedBroker || undefined,
            skipClosedPositions,
            simplifiedImport
        });
    };

    const handleDrag = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.type === "dragenter" || e.type === "dragover") {
            setDragActive(true);
        } else if (e.type === "dragleave") {
            setDragActive(false);
        }
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setDragActive(false);

        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            handleFileSelect(e.dataTransfer.files[0]);
        }
    };

    const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            handleFileSelect(e.target.files[0]);
        }
    };

    const handleReset = () => {
        setSelectedFile(null);
        setSummary(null);
        setSelectedBroker(null);
        setDetectedBroker(null);
        setImportResult(null);
    };

    const handleClose = () => {
        handleReset();
        onClose();
    };

    const activeBrokers = brokersData?.brokers.filter(b => b.supported) || [];

    return (
        <Modal isOpen={isOpen} onClose={handleClose} title="Import from Broker/Exchange">
            <div className="space-y-6">
                {/* Instructions */}
                <div className="glass-card p-4 rounded-lg border border-blue-500/20 bg-blue-500/5">
                    <div className="flex gap-3">
                        <AlertCircle className="h-5 w-5 text-blue-400 flex-shrink-0 mt-0.5" />
                        <div className="text-sm space-y-2">
                            <p className="font-medium text-blue-100">How to import:</p>
                            <ol className="list-decimal list-inside space-y-1 text-muted-foreground">
                                <li>Export your transaction history (Account Statement) from your broker</li>
                                <li>eToro supports <b>PDF</b> and <b>XLSX</b> (Excel) formats</li>
                                <li>Optionally select your broker below (or let us auto-detect)</li>
                                <li>Upload the file</li>
                                <li>Review the summary and import</li>
                            </ol>
                        </div>
                    </div>
                </div>

                {/* Broker Selection */}
                {activeBrokers.length > 0 && !summary && (
                    <div className="space-y-3">
                        <label className="text-sm font-medium">
                            Broker/Exchange (Optional - Auto-detect if not selected)
                        </label>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                            {activeBrokers.map((broker) => (
                                <button
                                    key={broker.id}
                                    onClick={() => setSelectedBroker(
                                        selectedBroker === broker.id ? null : broker.id
                                    )}
                                    className={cn(
                                        "p-3 rounded-lg border transition-all text-sm font-medium",
                                        selectedBroker === broker.id
                                            ? "border-primary bg-primary/10 text-primary"
                                            : "border-border/50 hover:border-primary/50 hover:bg-white/5"
                                    )}
                                >
                                    <div className="flex items-center gap-2">
                                        <Building2 className="h-4 w-4" />
                                        {broker.name}
                                    </div>
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {/* Options (Moved to top) */}
                <div className="glass-card p-4 rounded-lg space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {!simplifiedImport && (
                            <label className="flex items-center gap-3 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={skipClosedPositions}
                                    onChange={(e) => {
                                        const val = e.target.checked;
                                        setSkipClosedPositions(val);
                                        if (selectedFile) {
                                            uploadMutation.mutate({
                                                file: selectedFile,
                                                broker: selectedBroker || undefined,
                                                skipClosedPositions: val,
                                                simplifiedImport
                                            });
                                        }
                                    }}
                                    className="w-4 h-4 rounded border-border bg-white/5 text-primary focus:ring-primary"
                                />
                                <div>
                                    <div className="text-sm font-medium">Skip Closed Positions</div>
                                    <div className="text-xs text-muted-foreground">
                                        Do not import assets that currently have a 0 balance.
                                    </div>
                                </div>
                            </label>
                        )}

                        <label className={cn(
                            "flex items-center gap-3 cursor-pointer",
                            simplifiedImport && "col-span-full"
                        )}>
                            <input
                                type="checkbox"
                                checked={simplifiedImport}
                                onChange={(e) => {
                                    const val = e.target.checked;
                                    setSimplifiedImport(val);
                                    if (selectedFile) {
                                        uploadMutation.mutate({
                                            file: selectedFile,
                                            broker: selectedBroker || undefined,
                                            skipClosedPositions,
                                            simplifiedImport: val
                                        });
                                    }
                                }}
                                className="w-4 h-4 rounded border-border bg-white/5 text-primary focus:ring-primary"
                            />
                            <div>
                                <div className="text-sm font-medium">Simplified Import</div>
                                <div className="text-xs text-muted-foreground">
                                    Only import current holdings as a snapshot (automatically hides closed positions).
                                </div>
                            </div>
                        </label>
                    </div>
                </div>

                {/* File Upload Area */}
                {!summary && (
                    <div
                        className={cn(
                            "border-2 border-dashed rounded-xl p-8 text-center transition-all",
                            dragActive
                                ? "border-primary bg-primary/10"
                                : "border-border/50 hover:border-primary/50 hover:bg-white/5"
                        )}
                        onDragEnter={handleDrag}
                        onDragLeave={handleDrag}
                        onDragOver={handleDrag}
                        onDrop={handleDrop}
                    >
                        <input
                            type="file"
                            id="broker-upload"
                            accept=".csv,.xlsx,.xls,.pdf"
                            onChange={handleFileInput}
                            className="hidden"
                        />
                        <label
                            htmlFor="broker-upload"
                            className="cursor-pointer flex flex-col items-center gap-4"
                        >
                            <div className="p-4 rounded-full bg-primary/10">
                                <Upload className="h-8 w-8 text-primary" />
                            </div>
                            <div>
                                <p className="text-lg font-medium">
                                    {selectedFile ? selectedFile.name : 'Drop file here (CSV, XLSX, PDF) or click to browse'}
                                </p>
                                <p className="text-sm text-muted-foreground mt-1">
                                    {selectedBroker
                                        ? `Selected: ${activeBrokers.find(b => b.id === selectedBroker)?.name}`
                                        : 'Auto-detect broker from file'}
                                </p>
                            </div>
                            {(uploadMutation.isPending || detectMutation.isPending) && (
                                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-primary border-t-transparent" />
                                    {detectMutation.isPending ? 'Detecting broker...' : 'Parsing file...'}
                                </div>
                            )}
                            {detectedBroker && !summary && (
                                <div className="text-sm text-green-400 flex items-center gap-2">
                                    <CheckCircle2 className="h-4 w-4" />
                                    Detected: {detectedBroker.replace('_', ' ').toUpperCase()}
                                </div>
                            )}
                        </label>
                    </div>
                )}

                {/* Summary Display */}
                {summary && (
                    <div className="space-y-4 animate-fade-in">
                        {/* Header */}
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <CheckCircle2 className="h-5 w-5 text-green-500" />
                                <h3 className="font-semibold">
                                    Import Summary - {summary.broker.replace('_', ' ').toUpperCase()}
                                </h3>
                            </div>
                            <button
                                onClick={handleReset}
                                className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1"
                            >
                                <X className="h-4 w-4" />
                                Upload different file
                            </button>
                        </div>

                        {/* Stats Grid */}
                        <div className="grid grid-cols-2 gap-3">
                            <div className="glass-card p-4 rounded-lg">
                                <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
                                    <FileText className="h-4 w-4" />
                                    Total Transactions
                                </div>
                                <div className="text-2xl font-bold">{summary.total_transactions}</div>
                            </div>

                            <div className="glass-card p-4 rounded-lg">
                                <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
                                    <TrendingUp className="h-4 w-4" />
                                    Trades
                                </div>
                                <div className="text-2xl font-bold">{summary.buys + summary.sells}</div>
                            </div>

                            <div className="glass-card p-4 rounded-lg">
                                <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
                                    <DollarSign className="h-4 w-4" />
                                    Deposits
                                </div>
                                <div className="text-2xl font-bold text-green-500">
                                    ${summary.total_deposited.toLocaleString()}
                                </div>
                            </div>

                            <div className="glass-card p-4 rounded-lg">
                                <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
                                    <DollarSign className="h-4 w-4" />
                                    Withdrawals
                                </div>
                                <div className="text-2xl font-bold text-red-500">
                                    ${summary.total_withdrawn.toLocaleString()}
                                </div>
                            </div>
                        </div>

                        {/* Additional Details */}
                        <div className="glass-card p-4 rounded-lg space-y-3">
                            <div className="flex justify-between text-sm">
                                <span className="text-muted-foreground">Buys:</span>
                                <span className="font-medium text-green-500">{summary.buys}</span>
                            </div>
                            <div className="flex justify-between text-sm">
                                <span className="text-muted-foreground">Sells:</span>
                                <span className="font-medium text-red-500">{summary.sells}</span>
                            </div>
                            <div className="flex justify-between text-sm">
                                <span className="text-muted-foreground">Dividends:</span>
                                <span className="font-medium">{summary.dividends} (${summary.total_dividends.toLocaleString()})</span>
                            </div>
                            <div className="flex justify-between text-sm">
                                <span className="text-muted-foreground">Fees:</span>
                                <span className="font-medium">{summary.fees} (${summary.total_fees.toLocaleString()})</span>
                            </div>
                            <div className="flex justify-between text-sm">
                                <span className="text-muted-foreground">Unique Assets:</span>
                                <span className="font-medium">{summary.unique_assets}</span>
                            </div>
                            <div className="flex justify-between text-sm">
                                <span className="text-muted-foreground">Date Range:</span>
                                <span className="font-medium">
                                    {summary.date_range.start && summary.date_range.end
                                        ? `${new Date(summary.date_range.start).toLocaleDateString()} - ${new Date(summary.date_range.end).toLocaleDateString()}`
                                        : 'N/A'}
                                </span>
                            </div>
                        </div>

                        {/* Asset Tickers */}
                        {summary.asset_tickers.length > 0 && (
                            <div className="glass-card p-4 rounded-lg">
                                <div className="text-sm font-medium mb-2">Assets Found:</div>
                                <div className="flex flex-wrap gap-2">
                                    {summary.asset_tickers.map((ticker) => (
                                        <span
                                            key={ticker}
                                            className="px-2 py-1 rounded bg-primary/10 text-primary text-xs font-mono"
                                        >
                                            {ticker}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Warning about import */}
                        {!importResult && (
                            <div className="glass-card p-4 rounded-lg border border-blue-500/20 bg-blue-500/5">
                                <div className="flex gap-3">
                                    <AlertCircle className="h-5 w-5 text-blue-400 flex-shrink-0 mt-0.5" />
                                    <div className="text-sm space-y-2">
                                        <p className="font-medium text-blue-100">Ready to Import</p>
                                        <p className="text-muted-foreground">
                                            Review the summary above. Clicking "Import" will create the necessary assets and
                                            transactions in your portfolio. Duplicate transactions will be skipped.
                                        </p>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Import Success Result */}
                        {importResult && (
                            <div className="glass-card p-4 rounded-lg border border-green-500/20 bg-green-500/10">
                                <div className="flex gap-3">
                                    <CheckCircle2 className="h-6 w-6 text-green-400 flex-shrink-0" />
                                    <div>
                                        <p className="font-medium text-green-100">Import Complete!</p>
                                        <div className="text-sm text-green-400/80 space-y-1 mt-1">
                                            <p>• {importResult.imported} transactions successfully imported</p>
                                            <p>• {importResult.assets_created} new assets created</p>
                                            <p>• {importResult.skipped} duplicates or unsupported rows skipped</p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                <div className="flex justify-end gap-3 pt-4 border-t border-border/50">
                    <Button variant="outline" onClick={handleClose}>
                        {importResult ? 'Close' : 'Cancel'}
                    </Button>
                    {summary && !importResult && (
                        <Button
                            onClick={() => selectedFile && importMutation.mutate({
                                file: selectedFile,
                                broker: selectedBroker || undefined,
                                skipClosedPositions,
                                simplifiedImport
                            })}
                            disabled={importMutation.isPending}
                        >
                            {importMutation.isPending ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Importing...
                                </>
                            ) : (
                                'Confirm Import'
                            )}
                        </Button>
                    )}
                    {importResult && (
                        <Button
                            onClick={handleClose}
                            className="bg-green-600 hover:bg-green-700"
                        >
                            Finish
                        </Button>
                    )}
                </div>
            </div>
        </Modal>
    );
}
