import { Settings, Clock, Calendar, Hash, Globe } from 'lucide-react';
import { useSettingsContext } from '@/contexts/SettingsContext';
import { formatTime, formatDate, supportedTimezones } from '@/utils/datetime';
import { formatCurrency } from '@/lib/utils';
import { toast } from '@/services/toast';

export function PreferencesSettings() {
    const { settings, updateSettings } = useSettingsContext();
    // Derived state directly from settings (with defaults)
    const timeFormat = settings.time_format || 'auto';
    const dateFormat = settings.date_format || 'auto';
    const numberFormat = settings.number_format || 'auto';
    const timezone = settings.timezone || 'auto';

    const handleSetting = async (key: string, value: string) => {
        try {
            updateSettings({ [key]: value });
        } catch (error) {
            console.error('Failed to save setting:', error);
            toast.error('Failed to save setting');
        }
    };

    const sampleTime = new Date().toISOString();

    return (
        <div className="space-y-4">
            <div className="flex items-center gap-2 mb-2">
                <Settings className="w-5 h-5 text-primary" />
                <h2 className="text-xl font-semibold">Display Preferences</h2>
            </div>

            <div className="glass-card p-5 rounded-xl border border-white/10 grid grid-cols-1 md:grid-cols-2 gap-6 bg-black/20">
                {/* Time Format */}
                <div className="space-y-2">
                    <div className="flex items-center justify-between">
                        <label className="text-sm font-medium flex items-center gap-2 text-foreground/90">
                            <Clock className="w-4 h-4 text-primary/80" />
                            Time Format
                        </label>
                        <span className="text-xs font-mono text-muted-foreground bg-white/5 px-2 py-0.5 rounded border border-white/5">
                            {formatTime(sampleTime, timeFormat as "12h" | "24h" | "auto")}
                        </span>
                    </div>
                    <select
                        value={timeFormat}
                        onChange={(e) => handleSetting('time_format', e.target.value)}
                        className="w-full px-3 py-2 rounded-lg bg-black/40 border border-white/10 text-sm focus:outline-none focus:ring-1 focus:ring-primary/50 disabled:opacity-50 hover:bg-black/60 transition-colors text-foreground appearance-none cursor-pointer"
                    >
                        <option value="auto">Auto-detect</option>
                        <option value="12h">12-hour (AM/PM)</option>
                        <option value="24h">24-hour</option>
                    </select>
                </div>

                {/* Date Format */}
                <div className="space-y-2">
                    <div className="flex items-center justify-between">
                        <label className="text-sm font-medium flex items-center gap-2 text-foreground/90">
                            <Calendar className="w-4 h-4 text-primary/80" />
                            Date Format
                        </label>
                        <span className="text-xs font-mono text-muted-foreground bg-white/5 px-2 py-0.5 rounded border border-white/5">
                            {formatDate(sampleTime, dateFormat as "us" | "eu" | "ch" | "iso" | "auto")}
                        </span>
                    </div>
                    <select
                        value={dateFormat}
                        onChange={(e) => handleSetting('date_format', e.target.value)}
                        className="w-full px-3 py-2 rounded-lg bg-black/40 border border-white/10 text-sm focus:outline-none focus:ring-1 focus:ring-primary/50 disabled:opacity-50 hover:bg-black/60 transition-colors text-foreground appearance-none cursor-pointer"
                    >
                        <option value="auto">Auto-detect</option>
                        <option value="us">US (MM/DD/YYYY)</option>
                        <option value="eu">European (DD/MM/YYYY)</option>
                        <option value="ch">Swiss (DD.MM.YYYY)</option>
                        <option value="iso">ISO (YYYY-MM-DD)</option>
                    </select>
                </div>

                {/* Time Zone */}
                <div className="space-y-2">
                    <div className="flex items-center justify-between">
                        <label className="text-sm font-medium flex items-center gap-2 text-foreground/90">
                            <Globe className="w-4 h-4 text-primary/80" />
                            Time Zone
                        </label>
                        <span className="text-xs font-mono text-muted-foreground bg-white/5 px-2 py-0.5 rounded border border-white/5">
                            {formatTime(sampleTime, timeFormat as "12h" | "24h" | "auto", { timeZone: timezone === 'auto' ? undefined : timezone })}
                        </span>
                    </div>
                    <select
                        value={timezone}
                        onChange={(e) => handleSetting('timezone', e.target.value)}
                        className="w-full px-3 py-2 rounded-lg bg-black/40 border border-white/10 text-sm focus:outline-none focus:ring-1 focus:ring-primary/50 disabled:opacity-50 hover:bg-black/60 transition-colors text-foreground appearance-none cursor-pointer"
                    >
                        <option value="auto">Auto-detect ({Intl.DateTimeFormat().resolvedOptions().timeZone})</option>
                        {supportedTimezones.map((tz) => (
                            <option key={tz} value={tz}>
                                {tz.replace(/_/g, ' ')}
                            </option>
                        ))}
                    </select>
                </div>

                {/* Number Format */}
                <div className="space-y-2">
                    <div className="flex items-center justify-between">
                        <label className="text-sm font-medium flex items-center gap-2 text-foreground/90">
                            <Hash className="w-4 h-4 text-primary/80" />
                            Number Format
                        </label>
                        <span className="text-xs font-mono text-muted-foreground bg-white/5 px-2 py-0.5 rounded border border-white/5">
                            {formatCurrency(1234.56, 'USD', 2, numberFormat)}
                        </span>
                    </div>
                    <select
                        value={numberFormat}
                        onChange={(e) => handleSetting('number_format', e.target.value)}
                        className="w-full px-3 py-2 rounded-lg bg-black/40 border border-white/10 text-sm focus:outline-none focus:ring-1 focus:ring-primary/50 disabled:opacity-50 hover:bg-black/60 transition-colors text-foreground appearance-none cursor-pointer"
                    >
                        <option value="auto">Auto-detect</option>
                        <option value="us">US/UK (1,234.56)</option>
                        <option value="eu">European (1.234,56)</option>
                        <option value="ch">Swiss (1'234.56)</option>
                    </select>
                </div>
            </div>

        </div>
    );
}
