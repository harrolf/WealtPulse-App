
import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import api from '@/services/api';
import { Sliders, Save } from 'lucide-react';
import { toast } from '@/services/toast';

interface MarketDataSettings {
    use_mock_data: boolean;
    retention: {
        high_res_limit_days: number;
        medium_res_limit_days: number;
        compaction_interval_hours: number;
    };
}

interface UserSettings {
    currencies: string[];
    main_currency: string;
    secondary_currencies: string[];
    market_data?: MarketDataSettings;
    auth_providers?: Record<string, boolean>;
}

export function SystemConfig() {
    const queryClient = useQueryClient();
    const [isSaving, setIsSaving] = useState(false);

    const { data: settings, isLoading } = useQuery<UserSettings>({
        queryKey: ['system-config-data'],
        queryFn: async () => {
            const [userSettings, authConfig] = await Promise.all([
                api.get('/settings').then(res => res.data),
                api.get('/system/config/auth_providers').then(res => res.data).catch(() => ({ value: {} }))
            ]);
            return {
                ...userSettings,
                auth_providers: authConfig.value
            };
        }
    });

    const [formData, setFormData] = useState<UserSettings | null>(null);

    // Initialize form data when settings load
    if (settings && !formData) {
        setFormData(settings);
    }

    const handleSave = async () => {
        if (!formData) return;
        setIsSaving(true);
        try {
            // Save user/market settings
            const { auth_providers, ...userSettings } = formData;
            await Promise.all([
                api.put('/settings', userSettings),
                api.put('/system/settings/auth_providers', { value: auth_providers })
            ]);

            await queryClient.invalidateQueries({ queryKey: ['system-config-data'] });
            toast.success('Configuration saved successfully');
        } catch (error) {
            console.error('Failed to save settings:', error);
            toast.error('Failed to save configuration');
        } finally {
            setIsSaving(false);
        }
    };

    if (isLoading || !formData) return <div>Loading configuration...</div>;

    const marketData = formData.market_data || {
        use_mock_data: false,
        retention: { high_res_limit_days: 7, medium_res_limit_days: 60, compaction_interval_hours: 24 }
    };

    return (
        <div className="space-y-6 animate-slide-up">
            <h2 className="text-2xl font-semibold flex items-center gap-2">
                <Sliders className="h-6 w-6 text-primary" />
                System Configuration
            </h2>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Market Data Config */}
                <div className="glass-card p-6 rounded-xl border border-white/10 space-y-6">
                    <div className="flex items-center justify-between">
                        <h3 className="text-lg font-medium">Yahoo Finance Data</h3>
                        <div className="flex items-center gap-2">
                            <span className="text-sm text-muted-foreground">Provider Status:</span>
                            <span className="px-2 py-0.5 rounded text-xs font-bold bg-green-500/10 text-green-500 border border-green-500/20">
                                ACTIVE
                            </span>
                        </div>
                    </div>

                    <div className="space-y-4">
                        <div className="flex items-center justify-between p-4 rounded-lg bg-muted/20 border border-white/5">
                            <div>
                                <h4 className="font-medium">Use Mock Data</h4>
                                <p className="text-sm text-muted-foreground">For testing without API calls</p>
                            </div>
                            <label className="relative inline-flex items-center cursor-pointer">
                                <input
                                    type="checkbox"
                                    className="sr-only peer"
                                    checked={marketData.use_mock_data}
                                    onChange={(e) => setFormData({
                                        ...formData,
                                        market_data: {
                                            ...marketData,
                                            use_mock_data: e.target.checked
                                        }
                                    })}
                                />
                                <div className="w-11 h-6 bg-muted-foreground/30 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                            </label>
                        </div>

                        <div className="space-y-3 pt-4 border-t border-white/5">
                            <h4 className="font-medium text-sm text-muted-foreground uppercase tracking-wider">Data Retention Policy</h4>

                            <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4">
                                <p className="text-sm text-blue-200">
                                    Historical data retention is now managed by the <strong>Market Data Compaction</strong> agent.
                                </p>
                                <p className="text-xs text-blue-300/70 mt-1">
                                    Configure retention limits (High/Medium res days) in the <span className="font-mono">System Agents</span> section.
                                </p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Authentication Providers Config */}
                <div className="glass-card p-6 rounded-xl border border-white/10 space-y-6">
                    <h3 className="text-lg font-medium">Authentication Providers</h3>

                    <div className="space-y-4">
                        {['google', 'facebook', 'linkedin', 'apple', 'passkey'].map((provider) => (
                            <div key={provider} className="flex items-center justify-between p-4 rounded-lg bg-muted/20 border border-white/5">
                                <div>
                                    <h4 className="font-medium capitalize">{provider}</h4>
                                    <p className="text-sm text-muted-foreground">
                                        Allow users to sign in with {provider}
                                    </p>
                                </div>
                                <label className="relative inline-flex items-center cursor-pointer">
                                    <input
                                        type="checkbox"
                                        className="sr-only peer"
                                        checked={formData.auth_providers?.[provider] || false}
                                        onChange={(e) => {
                                            const newProviders = {
                                                ...(formData.auth_providers || {}),
                                                [provider]: e.target.checked
                                            };
                                            setFormData({
                                                ...formData,
                                                auth_providers: newProviders
                                            });
                                        }}
                                    />
                                    <div className="w-11 h-6 bg-muted-foreground/30 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                                </label>
                            </div>
                        ))}
                    </div>
                </div>

            </div>

            <div className="flex justify-end pt-4">
                <button
                    onClick={handleSave}
                    disabled={isSaving}
                    className="flex items-center gap-2 px-6 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50"
                >
                    <Save className="h-4 w-4" />
                    {isSaving ? 'Saving...' : 'Save Configuration'}
                </button>
            </div>
        </div>
    );
}
