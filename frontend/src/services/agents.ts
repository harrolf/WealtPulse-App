import api from './api';

export interface AgentSummary {
    id: number;
    name: string;
    description: string | null;
    status: string;
    is_enabled: boolean;
    last_run_at: string | null;
    next_run_at: string | null;
    last_duration_ms: number | null;
    last_error: string | null;
    schedule_type: string;
    schedule_value: string | null;
    config: Record<string, unknown>;
    agent_metadata: Record<string, unknown>;
}

export interface AgentLogEntry {
    id: number;
    level: string;
    message: string;
    details: Record<string, unknown> | null;
    timestamp: string;
}

export const AgentService = {
    listAgents: async (): Promise<AgentSummary[]> => {
        const response = await api.get('/admin/agents/');
        return response.data;
    },

    getLogs: async (name: string, limit: number = 100): Promise<AgentLogEntry[]> => {
        const response = await api.get(`/admin/agents/${encodeURIComponent(name)}/logs`, {
            params: { limit }
        });
        return response.data;
    },

    triggerAgent: async (name: string, payload?: Record<string, unknown>): Promise<void> => {
        await api.post(`/admin/agents/${encodeURIComponent(name)}/trigger`, payload || {});
    },

    stopAgent: async (name: string): Promise<void> => {
        await api.post(`/admin/agents/${encodeURIComponent(name)}/stop`);
    },

    updateAgent: async (name: string, payload: Partial<AgentSummary>): Promise<void> => {
        await api.patch(`/admin/agents/${encodeURIComponent(name)}`, payload);
    }
};
