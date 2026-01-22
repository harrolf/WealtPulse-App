
import { useQuery } from '@tanstack/react-query';
import api from '@/services/api';
import { Globe } from 'lucide-react';
import { cn, formatDate } from '@/lib/utils';
import { useSettings } from '@/contexts/SettingsContext';

interface ApiStatus {
    service: string;
    provider: string;
    update_frequency: string;
    last_updated: string | null;
    status: string;
    cache_items?: number;
    details?: {
        latency?: string;
        size?: string;
    };
    app_version?: string;
}

export function ApiStatusSection() {
    const { data: statusData } = useQuery({
        queryKey: ['system-status'],
        queryFn: async () => {
            const response = await api.get('/system/status');
            return response.data;
        },
        refetchInterval: 60000 // Refresh every minute
    });

    const settings = useSettings();

    const integrations: ApiStatus[] = statusData?.integrations || [];

    if (integrations.length === 0) return null;

    return (
        <div className="space-y-4">
            <h2 className="text-2xl font-semibold flex items-center gap-2">
                <Globe className="h-6 w-6 text-primary" />
                API Integrations
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {integrations.map((integration, idx) => (
                    <div key={idx} className="glass-card p-4 rounded-xl border border-white/10 space-y-3">
                        <div className="flex justify-between items-start">
                            <div>
                                <h3 className="font-medium text-foreground">{integration.service}</h3>
                                <p className="text-xs text-muted-foreground">{integration.provider}</p>
                            </div>
                            <div className={cn(
                                "px-2 py-0.5 rounded text-[10px] font-bold border",
                                integration.status === 'Online'
                                    ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20"
                                    : "bg-yellow-500/10 text-yellow-500 border-yellow-500/20"
                            )}>
                                {integration.status.toUpperCase()}
                            </div>
                        </div>

                        <div className="space-y-1 pt-2">
                            <div className="flex justify-between text-xs">
                                <span className="text-muted-foreground">Update Frequency</span>
                                <span className="font-medium">{integration.update_frequency}</span>
                            </div>
                            <div className="flex justify-between text-xs">
                                <span className="text-muted-foreground">Last Updated</span>
                                <span className="font-medium">
                                    {formatDate(integration.last_updated, settings.date_format, settings.time_format)}
                                </span>
                            </div>
                            {integration.details?.latency && (
                                <div className="flex justify-between text-xs">
                                    <span className="text-muted-foreground">Latency</span>
                                    <span className="font-medium">{integration.details.latency}</span>
                                </div>
                            )}
                            {integration.details?.size && (
                                <div className="flex justify-between text-xs">
                                    <span className="text-muted-foreground">Size</span>
                                    <span className="font-medium">{integration.details.size}</span>
                                </div>
                            )}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
