
export interface LogEntry {
    timestamp: string;
    message: string;
    details?: string;
    type: 'error' | 'warning' | 'info';
}

class ActionInfoService {
    private listeners: ((logs: LogEntry[]) => void)[] = [];
    private logs: LogEntry[] = [];
    private readonly MAX_LOGS = 50;

    constructor() {
        // Load from local storage if needed, but ephemeral is fine for now
    }

    log(message: string, details?: string, type: 'error' | 'warning' | 'info' = 'info') {
        const entry: LogEntry = {
            timestamp: new Date().toISOString(),
            message,
            details,
            type
        };

        this.logs.unshift(entry);
        if (this.logs.length > this.MAX_LOGS) {
            this.logs.pop();
        }
        this.notify();
    }

    error(message: string, details?: unknown) {
        this.log(message, typeof details === 'object' ? JSON.stringify(details) : String(details), 'error');
    }

    getLogs(): LogEntry[] {
        return this.logs;
    }

    subscribe(listener: (logs: LogEntry[]) => void) {
        this.listeners.push(listener);
        listener(this.logs);
        return () => {
            this.listeners = this.listeners.filter(l => l !== listener);
        };
    }

    private notify() {
        this.listeners.forEach(l => l(this.logs));
    }
}

export const actionLog = new ActionInfoService();
