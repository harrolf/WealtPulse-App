
import { Activity } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SystemMetrics {
    cpu_usage: number;
    memory_used_mb: number;
    memory_total_mb: number;
    memory_percent: number;
    disk_percent: number;
    disk_free_gb: number;
    app_uptime_seconds: number;
    app_memory_mb: number;
}

function formatUptime(seconds: number): string {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);

    if (days > 0) return `${days}d ${hours}h`;
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
}

export function SystemResources({ resources }: { resources?: SystemMetrics }) {
    if (!resources) return null;

    return (
        <div className="space-y-4">
            <h2 className="text-2xl font-semibold flex items-center gap-2">
                <Activity className="h-6 w-6 text-primary" />
                System Performance
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* CPU */}
                <div className="glass-card p-4 rounded-xl border border-white/10 space-y-3">
                    <div className="flex justify-between items-center mb-1">
                        <span className="text-sm font-medium">CPU Usage</span>
                        <span className="text-xs font-bold text-primary">{resources.cpu_usage}%</span>
                    </div>
                    <div className="w-full bg-white/5 rounded-full h-2">
                        <div className="bg-primary h-2 rounded-full transition-all duration-500" style={{ width: `${Math.min(resources.cpu_usage, 100)}%` }}></div>
                    </div>
                    <p className="text-xs text-muted-foreground pt-1">Process Load</p>
                </div>

                {/* RAM */}
                <div className="glass-card p-4 rounded-xl border border-white/10 space-y-3">
                    <div className="flex justify-between items-center mb-1">
                        <span className="text-sm font-medium">Memory</span>
                        <span className="text-xs font-bold text-primary">{resources.memory_percent}%</span>
                    </div>
                    <div className="w-full bg-white/5 rounded-full h-2">
                        <div className="bg-primary h-2 rounded-full transition-all duration-500" style={{ width: `${Math.min(resources.memory_percent, 100)}%` }}></div>
                    </div>
                    <div className="flex justify-between text-xs text-muted-foreground pt-1">
                        <span>{resources.memory_used_mb} MB used</span>
                        <span>{resources.memory_total_mb} MB total</span>
                    </div>
                </div>

                {/* Disk */}
                <div className="glass-card p-4 rounded-xl border border-white/10 space-y-3">
                    <div className="flex justify-between items-center mb-1">
                        <span className="text-sm font-medium">Disk</span>
                        <span className="text-xs font-bold text-primary">{resources.disk_percent}%</span>
                    </div>
                    <div className="w-full bg-white/5 rounded-full h-2">
                        <div className={cn(
                            "h-2 rounded-full transition-all duration-500",
                            resources.disk_percent > 80 ? "bg-red-500" : "bg-primary"
                        )} style={{ width: `${Math.min(resources.disk_percent, 100)}%` }}></div>
                    </div>
                    <p className="text-xs text-muted-foreground pt-1">{resources.disk_free_gb} GB free</p>
                </div>

                {/* App Stats */}
                <div className="glass-card p-4 rounded-xl border border-white/10 flex flex-col justify-center space-y-2">
                    <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">App Uptime</span>
                        <span className="font-medium font-mono">{formatUptime(resources.app_uptime_seconds)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">App Memory</span>
                        <span className="font-medium font-mono">{resources.app_memory_mb} MB</span>
                    </div>
                </div>
            </div>
        </div>
    );
}
