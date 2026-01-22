import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '@/services/api';
import { Scroll, AlertCircle, Info, CheckCircle, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { FormattedTime } from '@/components/ui/FormattedTime';

interface LogEntry {
    timestamp: string;
    level: 'INFO' | 'WARNING' | 'ERROR' | 'SUCCESS';
    message: string;
    component: string;
    details?: string | Record<string, unknown> | null; // Can be string or object (e.g., {traceback: string})
}

export function SystemLogs() {
    const [selectedLevels, setSelectedLevels] = useState<Set<string>>(new Set(['INFO', 'WARNING', 'ERROR', 'SUCCESS']));

    const { data: logs, isLoading } = useQuery<LogEntry[]>({
        queryKey: ['system-logs'],
        queryFn: async () => {
            const response = await api.get('/system/logs');
            return response.data;
        },
        refetchInterval: 5000, // Refresh every 5 seconds
        refetchIntervalInBackground: false // Only refetch when tab is active
    });

    const toggleLevel = (level: string) => {
        const newLevels = new Set(selectedLevels);
        if (newLevels.has(level)) {
            newLevels.delete(level);
        } else {
            newLevels.add(level);
        }
        setSelectedLevels(newLevels);
    };

    const filteredLogs = logs?.filter(log => selectedLevels.has(log.level)) || [];

    const getLevelIcon = (level: string) => {
        switch (level) {
            case 'ERROR': return <AlertCircle className="h-4 w-4 text-red-500" />;
            case 'WARNING': return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
            case 'SUCCESS': return <CheckCircle className="h-4 w-4 text-emerald-500" />;
            default: return <Info className="h-4 w-4 text-blue-500" />;
        }
    };

    const getLevelStyle = (level: string) => {
        switch (level) {
            case 'ERROR': return "bg-red-500/10 text-red-500 border-red-500/20";
            case 'WARNING': return "bg-yellow-500/10 text-yellow-500 border-yellow-500/20";
            case 'SUCCESS': return "bg-emerald-500/10 text-emerald-500 border-emerald-500/20";
            default: return "bg-blue-500/10 text-blue-500 border-blue-500/20";
        }
    };

    return (
        <div className="space-y-4 animate-fade-in">
            <div className="flex items-center justify-between gap-4">
                <h2 className="text-2xl font-semibold flex items-center gap-2 flex-shrink-0">
                    <Scroll className="h-6 w-6 text-primary" />
                    Global Logs
                </h2>
                <div className="flex gap-2 flex-shrink-0">
                    {['ERROR', 'WARNING', 'SUCCESS', 'INFO'].map(level => (
                        <button
                            key={level}
                            onClick={() => toggleLevel(level)}
                            className={cn(
                                "px-3 py-1 rounded-lg text-xs font-bold uppercase transition-all border",
                                selectedLevels.has(level)
                                    ? getLevelStyle(level)
                                    : "bg-muted/20 text-muted-foreground border-border/50 opacity-40 hover:opacity-70"
                            )}
                        >
                            {level}
                        </button>
                    ))}
                </div>
            </div>

            <div className="glass-strong rounded-xl border border-border/50 overflow-hidden min-h-[400px]">
                <table className="w-full text-sm">
                    <thead className="bg-muted/10">
                        <tr className="text-left text-xs font-medium text-muted-foreground uppercase">
                            <th className="px-6 py-3 w-[180px]">Timestamp</th>
                            <th className="px-6 py-3 w-[100px]">Level</th>
                            <th className="px-6 py-3 w-[150px]">Component</th>
                            <th className="px-6 py-3">Message</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-border/30">
                        {isLoading ? (
                            <tr><td colSpan={4} className="p-8 text-center text-muted-foreground">Loading logs...</td></tr>
                        ) : filteredLogs?.length === 0 ? (
                            <tr><td colSpan={4} className="p-8 text-center text-muted-foreground">No logs found.</td></tr>
                        ) : (
                            filteredLogs?.map((log, idx) => (
                                <tr key={idx} className="hover:bg-white/5 transition-colors font-mono text-xs">
                                    <td className="px-6 py-3 text-muted-foreground whitespace-nowrap">
                                        <FormattedTime
                                            timestamp={log.timestamp}
                                            mode="datetime"
                                        />
                                    </td>
                                    <td className="px-6 py-3">
                                        <span className={cn("inline-flex items-center gap-1.5 px-2 py-0.5 rounded border text-[10px] font-bold", getLevelStyle(log.level))}>
                                            {getLevelIcon(log.level)}
                                            {log.level}
                                        </span>
                                    </td>
                                    <td className="px-6 py-3 font-semibold text-foreground/80">
                                        {log.component}
                                    </td>
                                    <td className="px-6 py-3">
                                        <div className="text-foreground/90">{log.message}</div>
                                        {log.details && (
                                            <div className="text-muted-foreground mt-1 text-[10px] opacity-75 truncate max-w-xl">
                                                {typeof log.details === 'string'
                                                    ? log.details
                                                    : JSON.stringify(log.details)
                                                }
                                            </div>
                                        )}
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
