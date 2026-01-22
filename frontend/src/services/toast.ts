
import { useState, useEffect } from 'react';

export type ToastType = 'success' | 'error' | 'info' | 'warning';

export interface Toast {
    id: string;
    message: string;
    type: ToastType;
    duration?: number;
}

type Listener = (toasts: Toast[]) => void;
let toasts: Toast[] = [];
let listeners: Listener[] = [];

const notify = () => {
    listeners.forEach(listener => listener([...toasts]));
};

export const toast = {
    subscribe: (listener: Listener) => {
        listeners.push(listener);
        return () => {
            listeners = listeners.filter(l => l !== listener);
        };
    },
    add: (message: string, type: ToastType = 'info', duration = 5000) => {
        const id = Math.random().toString(36).substring(2, 9);
        const newToast = { id, message, type, duration };
        toasts = [...toasts, newToast];
        notify();

        if (duration !== Infinity) {
            setTimeout(() => {
                toast.remove(id);
            }, duration);
        }
        return id;
    },
    remove: (id: string) => {
        toasts = toasts.filter(t => t.id !== id);
        notify();
    },
    success: (message: string, duration?: number) => toast.add(message, 'success', duration),
    error: (message: string, duration?: number) => toast.add(message, 'error', duration),
    info: (message: string, duration?: number) => toast.add(message, 'info', duration),
    warning: (message: string, duration?: number) => toast.add(message, 'warning', duration),
};

export function useToasts() {
    const [currentToasts, setCurrentToasts] = useState<Toast[]>(toasts);

    useEffect(() => {
        return toast.subscribe(setCurrentToasts);
    }, []);

    return currentToasts;
}
