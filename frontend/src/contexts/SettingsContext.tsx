import { createContext, useContext, type ReactNode } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/services/api';

interface UserSettings {
    main_currency?: string;
    currencies?: string[];
    secondary_currencies?: string[];
    time_format?: 'auto' | '12h' | '24h';
    date_format?: 'auto' | 'us' | 'eu' | 'iso' | 'ch';
    number_format?: 'auto' | 'us' | 'eu' | 'ch';
    timezone?: string;
    market_data?: Record<string, unknown>;
}

interface SettingsContextType {
    settings: UserSettings;
    updateSettings: (newSettings: Partial<UserSettings>) => void;
    refetch: () => Promise<unknown>;
    isLoading: boolean;
    isUpdating: boolean;
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

interface SettingsProviderProps {
    children: ReactNode;
}

export function SettingsProvider({ children }: SettingsProviderProps) {
    const queryClient = useQueryClient();

    const { data: settings = {}, isLoading, refetch } = useQuery({
        queryKey: ['settings'],
        queryFn: async () => {
            const res = await api.get('/settings');
            return res.data as UserSettings;
        },
        staleTime: 5 * 60 * 1000, // 5 minutes
    });

    const mutation = useMutation({
        onMutate: async (newSettings: Partial<UserSettings>) => {
            // Cancel any outgoing refetches
            await queryClient.cancelQueries({ queryKey: ['settings'] });

            // Snapshot the previous value
            const previousSettings = queryClient.getQueryData(['settings']) as UserSettings;

            // Optimistically update to the new value
            queryClient.setQueryData(['settings'], (old: UserSettings) => ({ ...old, ...newSettings }));

            // Return a context object with the snapshotted value
            return { previousSettings };
        },
        mutationFn: async (newSettings: Partial<UserSettings>) => {
            // We just send the partial update to the backend
            const res = await api.put('/settings', newSettings);
            return res.data as UserSettings;
        },
        onError: (_err, _newSettings, context) => {
            // If the mutation fails, use the context returned from onMutate to roll back
            if (context?.previousSettings) {
                queryClient.setQueryData(['settings'], context.previousSettings);
            }
        },
        onSettled: () => {
            // Always refetch after error or success to ensure server state sync
            queryClient.invalidateQueries({ queryKey: ['settings'] });
        },
    });

    const updateSettings = (newSettings: Partial<UserSettings>) => {
        mutation.mutate(newSettings);
    };

    return (
        <SettingsContext.Provider value={{
            settings,
            updateSettings,
            refetch,
            isLoading,
            isUpdating: mutation.isPending
        }}>
            {children}
        </SettingsContext.Provider>
    );
}

// eslint-disable-next-line react-refresh/only-export-components
export const useSettings = () => {
    const context = useContext(SettingsContext);
    return context?.settings || {};
};

// eslint-disable-next-line react-refresh/only-export-components
export const useSettingsContext = () => {
    const context = useContext(SettingsContext);
    if (!context) {
        throw new Error('useSettingsContext must be used within SettingsProvider');
    }
    return context;
};
