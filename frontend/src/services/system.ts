import api from './api';

export interface SystemStatus {
    status: string;
    app_version: string;
    python_version: string;
    database: string;
    env: string;
}

export interface LogEntry {
    timestamp: string;
    level: string;
    logger: string;
    message: string;
}

export const SystemService = {
    getStatus: async () => {
        const response = await api.get<SystemStatus>('/system/status');
        return response.data;
    },

    getLogs: async (lines = 100) => {
        const response = await api.get<LogEntry[]>(`/system/logs?lines=${lines}`);
        return response.data;
    }
};
