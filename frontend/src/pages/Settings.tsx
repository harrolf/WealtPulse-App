
import { useState } from 'react';
import { Settings as SettingsIcon, Shield, Database, Sliders } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useQuery } from '@tanstack/react-query';
import api from '@/services/api';

import { SecuritySettings } from '@/components/settings/SecuritySettings';
import { DataManagement } from '@/components/settings/DataManagement';
import { PreferencesSettings } from '@/components/settings/PreferencesSettings';


export function Settings() {
    const [activeTab, setActiveTab] = useState<'security' | 'data' | 'preferences'>('security');

    const { data: statusData } = useQuery({
        queryKey: ['system-status'],
        queryFn: async () => {
            const response = await api.get('/system/status');
            return response.data;
        },
        refetchInterval: 60000 // Refresh every minute
    });

    return (
        <div className="space-y-8 animate-fade-in pb-10">
            {/* Header */}
            <div className="space-y-2">
                <div className="flex items-center gap-3">
                    <SettingsIcon className="h-6 w-6 text-primary" />
                    <h1 className="text-4xl font-bold bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text">Settings</h1>
                    {statusData?.app_version && (
                        <span className="px-2 py-1 rounded-full text-xs font-mono bg-primary/10 text-primary border border-primary/20">
                            v{statusData.app_version}
                        </span>
                    )}
                </div>
                <p className="text-muted-foreground text-lg">
                    Manage your account and preferences.
                </p>
            </div>

            {/* Quick Stats / Overview or just simple tabs */}
            <div className="flex flex-col md:flex-row gap-6">
                {/* Sidebar Navigation */}
                <div className="w-full md:w-64 flex flex-row md:flex-col gap-2 overflow-x-auto md:overflow-visible pb-2 md:pb-0">


                    <button
                        onClick={() => setActiveTab('security')}
                        className={cn(
                            "flex items-center gap-3 px-4 py-3 rounded-xl transition-all whitespace-nowrap",
                            activeTab === 'security'
                                ? "bg-primary text-primary-foreground shadow-lg shadow-primary/25"
                                : "hover:bg-white/5 text-muted-foreground hover:text-foreground"
                        )}
                    >
                        <Shield className="w-5 h-5" />
                        <span className="font-medium">Security</span>
                    </button>

                    <button
                        onClick={() => setActiveTab('data')}
                        className={cn(
                            "flex items-center gap-3 px-4 py-3 rounded-xl transition-all whitespace-nowrap",
                            activeTab === 'data'
                                ? "bg-primary text-primary-foreground shadow-lg shadow-primary/25"
                                : "hover:bg-white/5 text-muted-foreground hover:text-foreground"
                        )}
                    >
                        <Database className="w-5 h-5" />
                        <span className="font-medium">My Data</span>
                    </button>

                    <button
                        onClick={() => setActiveTab('preferences')}
                        className={cn(
                            "flex items-center gap-3 px-4 py-3 rounded-xl transition-all whitespace-nowrap",
                            activeTab === 'preferences'
                                ? "bg-primary text-primary-foreground shadow-lg shadow-primary/25"
                                : "hover:bg-white/5 text-muted-foreground hover:text-foreground"
                        )}
                    >
                        <Sliders className="w-5 h-5" />
                        <span className="font-medium">Preferences</span>
                    </button>
                </div>

                {/* Content Area */}
                <div className="flex-1 min-h-[500px]">


                    {activeTab === 'security' && (
                        <div className="max-w-3xl">
                            <SecuritySettings />
                        </div>
                    )}

                    {activeTab === 'data' && (
                        <DataManagement />
                    )}

                    {activeTab === 'preferences' && (
                        <div className="max-w-3xl">
                            <PreferencesSettings />
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
