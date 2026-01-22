import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
    Server, Play, Square, Settings, AlertCircle,
    Activity, Power, PowerOff, Clock, FileText
} from 'lucide-react';
import { AgentService, type AgentSummary } from '@/services/agents';
import { cn } from '@/lib/utils';
import { toast } from '@/services/toast';
import { Modal } from '@/components/ui/Modal';
import { RunBackfillModal } from '../modals/RunBackfillModal';
import { FormattedTime } from '@/components/ui/FormattedTime';

// Metadata for specific configuration keys to provide better UI
const CONFIG_METADATA: Record<string, { label: string; description: string }> = {
    retention_5min_days: {
        label: "Keep 5-Min Detail (Days)",
        description: "Data aged < this limit is kept at original 5-min resolution. Older data becomes 15-min."
    },
    retention_15min_days: {
        label: "Keep 15-Min Detail (Days)",
        description: "Data aged < this limit is kept at 15-min resolution. Older data becomes 1-hour."
    },
    retention_1h_days: {
        label: "Keep Hourly Detail (Days)",
        description: "Data aged < this limit is kept at 1-hour resolution. Older data becomes 1-day."
    },
    retention_1d_days: {
        label: "Keep Daily Detail (Days)",
        description: "Data aged < this limit is kept at 1-day resolution. Older data becomes 1-week."
    },
    log_retention_days: {
        label: "Log Retention (Days)",
        description: "System and Agent logs older than this limit will be permanently deleted."
    }
};

export function BackgroundAgentsTable() {
    const queryClient = useQueryClient();
    const [selectedAgentForLogs, setSelectedAgentForLogs] = useState<string | null>(null);
    const [selectedAgentForConfig, setSelectedAgentForConfig] = useState<AgentSummary | null>(null);
    const [agentToConfirmRun, setAgentToConfirmRun] = useState<string | null>(null);
    const [backfillAgent, setBackfillAgent] = useState<AgentSummary | null>(null);

    const { data: agents, isLoading } = useQuery<AgentSummary[]>({
        queryKey: ['admin-agents'],
        queryFn: AgentService.listAgents,
        refetchInterval: 5000
    });

    const triggerMutation = useMutation({
        mutationFn: ({ name, payload }: { name: string; payload?: Record<string, unknown> }) => AgentService.triggerAgent(name, payload),
        onSuccess: (_, { name }) => {
            toast.success(`Agent ${name} triggered`);
            queryClient.invalidateQueries({ queryKey: ['admin-agents'] });
            setAgentToConfirmRun(null);
            setBackfillAgent(null);
        },
        onError: (err: Error) => toast.error(`Failed to trigger agent: ${err.message}`)
    });

    const stopMutation = useMutation({
        mutationFn: AgentService.stopAgent,
        onSuccess: (_, name) => {
            toast.info(`Stop requested for ${name}`);
            queryClient.invalidateQueries({ queryKey: ['admin-agents'] });
        },
        onError: (err: Error) => toast.error(`Failed to stop agent: ${err.message}`)
    });

    const toggleMutation = useMutation({
        mutationFn: ({ name, is_enabled }: { name: string, is_enabled: boolean }) =>
            AgentService.updateAgent(name, { is_enabled }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['admin-agents'] });
            toast.success("Agent status updated");
        },
        onError: (err: Error) => toast.error(`Failed to update agent: ${err.message}`)
    });

    if (isLoading) return (
        <div className="flex flex-col items-center justify-center p-20 space-y-4">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
            <p className="text-muted-foreground animate-pulse">Establishing connection to agent fleet...</p>
        </div>
    );

    return (
        <div className="space-y-6 animate-slide-up">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold flex items-center gap-2">
                        <Server className="h-6 w-6 text-primary" />
                        System Agents
                    </h2>
                    <p className="text-sm text-muted-foreground mt-1">
                        Monitor and control background processes.
                    </p>
                </div>
                <div className="flex items-center gap-4 bg-muted/20 px-4 py-2 rounded-lg border border-border/50">
                    <div className="flex items-center gap-2">
                        <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                        <span className="text-xs font-medium">Fleet Online</span>
                    </div>
                    <div className="w-px h-4 bg-border" />
                    <span className="text-xs text-muted-foreground">{agents?.length || 0} Agents</span>
                </div>
            </div>

            <div className="glass-strong rounded-xl border border-border/50 overflow-hidden">
                <table className="w-full">
                    <thead className="bg-muted/10 border-b border-border/50">
                        <tr className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider whitespace-nowrap">
                            <th className="px-6 py-4">Agent Name</th>
                            <th className="px-6 py-4">Last Activity</th>
                            <th className="px-6 py-4">Schedules</th>
                            <th className="px-6 py-4 text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-border/50 text-sm">
                        {agents?.map((agent) => (
                            <tr key={agent.id} className={cn(
                                "group transition-colors",
                                agent.status === 'running' ? "bg-primary/5 hover:bg-primary/10" : "hover:bg-muted/50"
                            )}>
                                <td className="px-6 py-4">
                                    <div className="flex items-start gap-4">
                                        <div
                                            title={`Status: ${agent.status.toUpperCase()}${!agent.is_enabled ? ' (DISABLED)' : ''}`}
                                            className={cn(
                                                "w-2.5 h-2.5 rounded-full mt-2 shrink-0 transition-all duration-500 cursor-help",
                                                agent.status === 'running' ? "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)] animate-pulse" :
                                                    agent.status === 'failed' ? "bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.4)]" :
                                                        !agent.is_enabled ? "bg-white/10 border border-white/20" :
                                                            "bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.4)]"
                                            )} />
                                        <div className="space-y-1">
                                            <div className="font-semibold text-base flex items-center gap-2">
                                                {agent.name}
                                            </div>
                                            <div className="text-xs text-muted-foreground max-w-sm">{agent.description}</div>
                                        </div>
                                    </div>
                                </td>

                                <td className="px-6 py-4 align-top">
                                    <div className="flex flex-col gap-1.5 pt-1">
                                        {agent.last_run_at ? (
                                            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                                <Clock className="w-3 h-3" />
                                                <FormattedTime
                                                    timestamp={agent.last_run_at}
                                                    mode="time"
                                                    className="font-mono"
                                                />
                                            </div>
                                        ) : (
                                            <span className="text-xs text-muted-foreground italic">Never run</span>
                                        )}
                                        {agent.last_error && (
                                            <div className="flex items-center gap-1.5 text-xs text-red-400 font-mono mt-1">
                                                <AlertCircle className="w-3 h-3" />
                                                Err: {agent.last_error.substring(0, 20)}...
                                            </div>
                                        )}
                                    </div>
                                </td>

                                <td className="px-6 py-4 align-top">
                                    <div className="space-y-1">
                                        <div className="flex items-center gap-1.5 text-xs font-medium text-foreground/80">
                                            <Settings className="w-3 h-3" />
                                            {agent.schedule_type === 'manual' ? 'Manual' :
                                                agent.schedule_type === 'cron' ? `Cron (${agent.schedule_value})` :
                                                    `Interval (${agent.schedule_value}s)`}
                                        </div>
                                        <div className="text-xs text-muted-foreground flex gap-1 items-center">
                                            <Activity className="w-3 h-3" />
                                            Last Duration: <span className="font-mono text-foreground">{agent.last_duration_ms ? `${agent.last_duration_ms}ms` : '-'}</span>
                                        </div>
                                    </div>
                                </td>

                                <td className="px-6 py-4 align-middle text-right">
                                    <div className="flex items-center justify-end gap-2">
                                        <button
                                            onClick={() => setSelectedAgentForLogs(agent.name)}
                                            className="p-2 text-muted-foreground hover:text-primary bg-muted/30 hover:bg-primary/10 rounded-lg transition-colors border border-transparent hover:border-primary/20"
                                            title="View Logs"
                                        >
                                            <FileText className="w-4 h-4" />
                                        </button>

                                        <button
                                            onClick={() => setSelectedAgentForConfig(agent)}
                                            className="p-2 text-muted-foreground hover:text-foreground bg-muted/30 hover:bg-white/10 rounded-lg transition-colors border border-transparent hover:border-white/20"
                                            title="Configure"
                                        >
                                            <Settings className="w-4 h-4" />
                                        </button>

                                        <div className="w-px h-6 bg-border mx-1" />

                                        {agent.status === 'running' ? (
                                            <button
                                                onClick={() => stopMutation.mutate(agent.name)}
                                                className="p-2 text-red-400 hover:text-red-500 bg-red-500/10 hover:bg-red-500/20 rounded-lg transition-colors border border-red-500/20"
                                                title="Stop Agent"
                                            >
                                                <Square className="w-4 h-4" />
                                            </button>
                                        ) : (
                                            <button
                                                onClick={() => {
                                                    if (agent.name === 'Market Data Backfill') {
                                                        setBackfillAgent(agent);
                                                    } else {
                                                        setAgentToConfirmRun(agent.name);
                                                    }
                                                }}
                                                disabled={!agent.is_enabled || triggerMutation.isPending}
                                                className="p-2 text-primary hover:text-primary-foreground bg-primary/10 hover:bg-primary rounded-lg transition-colors border border-primary/20 disabled:opacity-30 disabled:cursor-not-allowed"
                                                title="Run Now"
                                            >
                                                <Play className="w-4 h-4" />
                                            </button>
                                        )}

                                        <button
                                            onClick={() => toggleMutation.mutate({ name: agent.name, is_enabled: !agent.is_enabled })}
                                            className={cn(
                                                "p-2 rounded-lg transition-colors border",
                                                agent.is_enabled
                                                    ? "text-emerald-500 hover:text-red-500 bg-emerald-500/5 hover:bg-red-500/10 border-emerald-500/20 hover:border-red-500/20"
                                                    : "text-muted-foreground hover:text-emerald-500 bg-muted/30 hover:bg-emerald-500/10 border-transparent hover:border-emerald-500/20"
                                            )}
                                            title={agent.is_enabled ? "Disable Agent" : "Enable Agent"}
                                        >
                                            {agent.is_enabled ? <Power className="w-4 h-4" /> : <PowerOff className="w-4 h-4" />}
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Logs Modal */}
            <LogsModal
                agentName={selectedAgentForLogs}
                onClose={() => setSelectedAgentForLogs(null)}
            />

            {/* Backfill Modal */}
            {backfillAgent && (
                <RunBackfillModal
                    isOpen={true}
                    onClose={() => setBackfillAgent(null)}
                    onRun={(params) => triggerMutation.mutate({ name: backfillAgent.name, payload: params })}
                />
            )}

            {/* Run Confirmation Modal */}
            <Modal
                isOpen={!!agentToConfirmRun}
                onClose={() => setAgentToConfirmRun(null)}
                title="Confirm Execution"
                className="max-w-sm"
            >
                <div className="space-y-4">
                    <p className="text-sm text-muted-foreground">
                        Are you sure you want to run <span className="font-bold text-foreground">{agentToConfirmRun}</span> manually?
                    </p>
                    <div className="flex justify-end gap-3 pt-2">
                        <button
                            onClick={() => setAgentToConfirmRun(null)}
                            className="px-4 py-2 rounded-lg hover:bg-muted/50 transition-colors text-sm"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={() => {
                                if (agentToConfirmRun) triggerMutation.mutate({ name: agentToConfirmRun });
                            }}
                            className="px-4 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors text-sm font-medium"
                        >
                            Run Agent
                        </button>
                    </div>
                </div>
            </Modal>

            {/* Config Modal */}
            {selectedAgentForConfig && (
                <ConfigModal
                    agent={selectedAgentForConfig}
                    onClose={() => setSelectedAgentForConfig(null)}
                    onUpdated={() => {
                        queryClient.invalidateQueries({ queryKey: ['admin-agents'] });
                    }}
                />
            )}
        </div>
    );
}

function LogsModal({ agentName, onClose }: { agentName: string | null, onClose: () => void }) {
    const { data: logs, isLoading } = useQuery({
        queryKey: ['agent-logs', agentName],
        queryFn: () => agentName ? AgentService.getLogs(agentName) : Promise.resolve([]),
        enabled: !!agentName,
        refetchInterval: 2000 // Live logs
    });

    return (
        <Modal
            isOpen={!!agentName}
            onClose={onClose}
            title={
                <div className='flex items-center gap-2'>
                    <FileText className="h-5 w-5 text-primary" />
                    <span>Logs: {agentName}</span>
                </div>
            }
            className="max-w-4xl"
        >
            <div className="bg-black/40 rounded-xl border border-white/5 overflow-hidden flex flex-col h-[600px]">
                <div className="p-4 border-b border-white/10 bg-white/5 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Activity className="h-4 w-4 text-emerald-500 animate-pulse" />
                        <span className="text-xs font-mono text-emerald-500">LIVE FEED</span>
                    </div>
                    <div className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold">
                        Last 100 entries
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-4 font-mono text-xs space-y-2">
                    {isLoading ? (
                        <div className="h-full flex items-center justify-center text-muted-foreground">
                            Buffering stream...
                        </div>
                    ) : logs && logs.length > 0 ? (
                        logs.map((log) => (
                            <div key={log.id} className="flex gap-3 group hover:bg-white/5 p-1.5 rounded transition-colors border-l-2 border-transparent hover:border-white/10">
                                <FormattedTime
                                    timestamp={log.timestamp}
                                    mode="time"
                                    className="text-muted-foreground/40 whitespace-nowrap min-w-[120px]"
                                    showTimezoneTooltip={true}
                                />
                                <span className={cn(
                                    "font-bold min-w-[70px]",
                                    log.level === 'ERROR' ? "text-red-500" :
                                        log.level === 'WARNING' ? "text-yellow-500" :
                                            log.level === 'SUCCESS' ? "text-emerald-500" :
                                                "text-blue-400"
                                )}>
                                    {log.level}
                                </span>
                                <span className="text-foreground/90 flex-1 break-all">{log.message}</span>
                            </div>
                        ))
                    ) : (
                        <div className="h-full flex items-center justify-center text-muted-foreground italic">
                            No logs found for this agent.
                        </div>
                    )}
                </div>
            </div>
        </Modal>
    );
}

function ConfigModal({ agent, onClose, onUpdated }: { agent: AgentSummary, onClose: () => void, onUpdated: () => void }) {
    const [scheduleType, setScheduleType] = useState(agent.schedule_type);
    const [scheduleValue, setScheduleValue] = useState(agent.schedule_value || '');
    const [isEnabled, setIsEnabled] = useState(agent.is_enabled);
    const [configJson, setConfigJson] = useState(JSON.stringify(agent.config || {}, null, 2));

    const mutation = useMutation({
        mutationFn: (data: Partial<AgentSummary>) => AgentService.updateAgent(agent.name, data),
        onSuccess: () => {
            toast.success("Agent configuration updated");
            onUpdated();
            onClose();
        },
        onError: (err: Error) => toast.error(`Update failed: ${err.message}`)
    });

    const handleSave = () => {
        let parsedConfig = {};
        try {
            parsedConfig = JSON.parse(configJson);
        } catch {
            toast.error("Invalid JSON configuration");
            return;
        }

        // Parse manually to ensure numbers are numbers if possible, but keep structure
        const finalConfig = parsedConfig as Record<string, unknown>;
        mutation.mutate({
            schedule_type: scheduleType,
            schedule_value: scheduleValue,
            is_enabled: isEnabled,
            config: finalConfig
        });
    };

    return (
        <Modal
            isOpen={true}
            onClose={onClose}
            title={`Configure ${agent.name}`}
            className="max-w-lg"
        >
            <div className="space-y-6">
                <div className="space-y-4">
                    <div className="flex items-center justify-between p-4 rounded-lg bg-muted/20 border border-border/50">
                        <label className="text-sm font-medium">Agent Enabled</label>
                        <button
                            onClick={() => setIsEnabled(!isEnabled)}
                            className={cn(
                                "relative inline-flex h-6 w-11 items-center rounded-full transition-colors",
                                isEnabled ? "bg-primary" : "bg-muted"
                            )}
                        >
                            <span className={cn(
                                "inline-block h-4 w-4 transform rounded-full bg-white transition-transform",
                                isEnabled ? "translate-x-6" : "translate-x-1"
                            )} />
                        </button>
                    </div>

                    <div className="space-y-2">
                        <label className="text-xs uppercase tracking-wider text-muted-foreground font-bold">Schedule Type</label>
                        <select
                            value={scheduleType}
                            onChange={(e) => setScheduleType(e.target.value)}
                            className="w-full bg-background border border-input rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary/20 outline-none"
                        >
                            <option value="manual">Manual (Trigger Only)</option>
                            <option value="interval">Interval (Seconds)</option>
                            <option value="cron">Cron Expression</option>
                        </select>
                    </div>

                    {scheduleType !== 'manual' && (
                        <div className="space-y-2">
                            <label className="text-xs uppercase tracking-wider text-muted-foreground font-bold">
                                {scheduleType === 'interval' ? 'Interval (Seconds)' : 'Cron Syntax'}
                            </label>
                            <input
                                type="text"
                                value={scheduleValue}
                                onChange={(e) => setScheduleValue(e.target.value)}
                                placeholder={scheduleType === 'interval' ? "e.g. 3600" : "e.g. 0 0 * * *"}
                                className="w-full bg-background border border-input rounded-lg px-3 py-2 text-sm font-mono focus:ring-2 focus:ring-primary/20 outline-none"
                            />
                            <p className="text-[10px] text-muted-foreground">
                                {scheduleType === 'interval'
                                    ? "Run every X seconds from system start."
                                    : "Standard cron syntax options."}
                            </p>
                        </div>
                    )}

                    {/* Dynamic Configuration Form */}
                    <div className="space-y-4 pt-4 border-t border-border/50">
                        <div className="flex items-center justify-between">
                            <label className="text-xs uppercase tracking-wider text-muted-foreground font-bold">
                                Agent Parameters
                            </label>
                        </div>

                        {/* Agent Description from Backend */}
                        {agent.description && (
                            <div className="bg-muted/30 border border-border/50 rounded-lg p-3 text-xs text-muted-foreground leading-relaxed whitespace-pre-line">
                                {agent.description}
                            </div>
                        )}

                        {Object.entries(agent.config || {}).length === 0 ? (
                            <div className="text-sm text-muted-foreground italic bg-muted/20 p-4 rounded-lg text-center">
                                No configurable parameters available.
                            </div>
                        ) : (
                            <div className="grid gap-4">
                                {Object.keys(agent.config || {}).map((key) => {
                                    // Parse value from JSON state for this key
                                    let currentValue;
                                    try {
                                        const parsed = JSON.parse(configJson);
                                        currentValue = parsed[key];
                                    } catch {
                                        currentValue = "";
                                    }

                                    const metadata = CONFIG_METADATA[key];
                                    const label = metadata ? metadata.label : key.replace(/_/g, ' ');

                                    return (
                                        <div key={key} className="space-y-1.5">
                                            <label className="text-xs font-bold text-foreground/80 capitalize">
                                                {label}
                                            </label>
                                            <input
                                                type={typeof currentValue === 'number' ? 'number' : 'text'}
                                                value={currentValue}
                                                onChange={(e) => {
                                                    try {
                                                        const parsed = JSON.parse(configJson);
                                                        // Auto-convert numbers
                                                        const val = e.target.type === 'number'
                                                            ? parseFloat(e.target.value)
                                                            : e.target.value;

                                                        parsed[key] = val;
                                                        setConfigJson(JSON.stringify(parsed, null, 2));
                                                    } catch {
                                                        // Should not happen if state is valid JSON
                                                    }
                                                }}
                                                className="w-full bg-background border border-input rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary/20 outline-none transition-all hover:border-primary/30"
                                            />
                                            {metadata?.description && (
                                                <p className="text-[11px] text-muted-foreground leading-snug">
                                                    {metadata.description}
                                                </p>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                        <p className="text-[10px] text-muted-foreground">
                            modify specific execution parameters above.
                        </p>
                    </div>
                </div>

                <div className="flex justify-end gap-3 pt-4 border-t border-border/50">
                    <button onClick={onClose} className="px-4 py-2 rounded-lg hover:bg-muted/50 transition-colors text-sm">Cancel</button>
                    <button
                        onClick={handleSave}
                        disabled={mutation.isPending}
                        className="px-4 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors text-sm font-medium disabled:opacity-50"
                    >
                        {mutation.isPending ? 'Saving...' : 'Save Changes'}
                    </button>
                </div>
            </div>
        </Modal>
    );
}
