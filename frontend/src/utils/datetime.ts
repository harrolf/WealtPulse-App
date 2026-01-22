/**
 * Datetime utility functions for formatting UTC timestamps to user's local timezone
 * with configurable time format preference (12h/24h)
 */

/**
 * Detect if browser locale uses 24-hour format by default
 */
function browserUses24Hour(): boolean {
    const locale = navigator.language;
    const sample = new Intl.DateTimeFormat(locale, {
        hour: 'numeric'
    }).format(new Date(2020, 0, 1, 13));

    return !sample.match(/AM|PM/i);
}

/**
 * Determine hour12 setting based on user preference
 * Note: This is a simple version. In React components, use the hook version.
 */
function shouldUse12Hour(preference?: 'auto' | '12h' | '24h'): boolean {
    if (preference === '12h') return true;
    if (preference === '24h') return false;
    // auto or undefined - use browser detection
    return !browserUses24Hour();
}


/**
 * Common timezones for selection
 */
export const supportedTimezones = [
    "UTC",
    "America/New_York",
    "America/Los_Angeles",
    "America/Chicago",
    "Europe/London",
    "Europe/Paris",
    "Europe/Zurich",
    "Europe/Berlin",
    "Asia/Tokyo",
    "Asia/Singapore",
    "Australia/Sydney",
    "Pacific/Auckland"
];

// Add all supported browser timezones if available
try {
    if (Intl && 'supportedValuesOf' in Intl) {
        // Typescript might not know about supportedValuesOf yet depending on lib ver
        const all = Intl.supportedValuesOf('timeZone');
        if (all && all.length > 0) {
            // We'll stick to the common ones for the dropdown to avoid 500-item list, 
            // or just expose the common ones + basic regions. 
            // For now, let's just use the comprehensive list if the user wants "Show All" 
            // but the UI request was just "Add a time-zone option".
            // Let's stick to a reliable subset + browser default logic.
        }
    }
} catch {
    // ignore
}

/**
 * Format UTC datetime string to user's local timezone
 */
export function formatDateTime(
    utcString: string | null | undefined,
    timeFormat?: 'auto' | '12h' | '24h',
    dateFormatPref?: 'auto' | 'us' | 'eu' | 'iso' | 'ch',
    options?: Intl.DateTimeFormatOptions
): string {
    if (!utcString) return '';

    const date = new Date(utcString);
    if (isNaN(date.getTime())) return utcString;

    // For custom formats (ISO/Swiss), compose them manually using Intl to respect TimeZone
    if (dateFormatPref === 'iso' || dateFormatPref === 'ch') {
        const datePart = formatDate(utcString, dateFormatPref, options);
        // Pass options to ensure timezone is respected
        const timePart = formatTime(utcString, timeFormat, options);
        return `${datePart} ${timePart}`;
    }

    const hour12 = shouldUse12Hour(timeFormat);

    // Determine locale based on preference
    let locale: string | undefined = undefined;
    if (dateFormatPref === 'us') locale = 'en-US';
    else if (dateFormatPref === 'eu') locale = 'en-GB';

    const defaultOptions: Intl.DateTimeFormatOptions = {
        year: 'numeric',
        month: 'numeric',
        day: 'numeric',
        hour: 'numeric',
        minute: 'numeric',
        second: 'numeric',
        hour12,
        ...options
    };

    try {
        return new Intl.DateTimeFormat(locale, defaultOptions).format(date);
    } catch {
        // Fallback for invalid timezone
        return new Intl.DateTimeFormat(locale, { ...defaultOptions, timeZone: undefined }).format(date);
    }
}

/**
 * Format date only (no time) with optional format preference
 */
export function formatDate(
    utcString: string | null | undefined,
    dateFormatPref?: 'auto' | 'us' | 'eu' | 'iso' | 'ch',
    options?: Intl.DateTimeFormatOptions
): string {
    if (!utcString) return '';

    const date = new Date(utcString);
    if (isNaN(date.getTime())) return utcString;

    const useOptions = { ...options };
    // If timezone is invalid, it throws. catch it?

    try {
        // ISO format override (YYYY-MM-DD)
        if (dateFormatPref === 'iso') {
            // en-CA is YYYY-MM-DD
            return new Intl.DateTimeFormat('en-CA', {
                year: 'numeric', month: '2-digit', day: '2-digit',
                timeZone: useOptions.timeZone
            }).format(date);
        }

        // Swiss format override (DD.MM.YYYY)
        if (dateFormatPref === 'ch') {
            // en-GB is DD/MM/YYYY
            const part = new Intl.DateTimeFormat('en-GB', {
                year: 'numeric', month: '2-digit', day: '2-digit',
                timeZone: useOptions.timeZone
            }).format(date);
            return part.replace(/\//g, '.');
        }

        // Determine locale based on preference
        let locale: string | undefined = undefined;
        if (dateFormatPref === 'us') locale = 'en-US';
        else if (dateFormatPref === 'eu') locale = 'en-GB';
        // 'auto' uses browser default (undefined)

        const defaultOptions: Intl.DateTimeFormatOptions = {
            year: 'numeric',
            month: 'numeric',
            day: 'numeric',
            ...useOptions
        };

        return new Intl.DateTimeFormat(locale, defaultOptions).format(date);
    } catch (e) {
        // If timezone fails, retry without it
        console.warn("Date format failed, likely invalid timezone", e);
        if (useOptions.timeZone) {
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            const { timeZone: _, ...rest } = useOptions;
            return formatDate(utcString, dateFormatPref, rest);
        }
        return date.toLocaleDateString();
    }
}

/**
 * Format time only (no date)
 */
export function formatTime(
    utcString: string | null | undefined,
    timeFormat?: 'auto' | '12h' | '24h',
    options?: Intl.DateTimeFormatOptions
): string {
    if (!utcString) return '';

    const date = new Date(utcString);
    if (isNaN(date.getTime())) return utcString;

    const hour12 = shouldUse12Hour(timeFormat);

    const defaultOptions: Intl.DateTimeFormatOptions = {
        hour: 'numeric',
        minute: 'numeric',
        second: 'numeric',
        hour12,
        ...options
    };

    try {
        return new Intl.DateTimeFormat(undefined, defaultOptions).format(date);
    } catch {
        if (options?.timeZone) {
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            const { timeZone: _, ...rest } = options || {};
            return formatTime(utcString, timeFormat, { ...rest, hour12 });
        }
        return date.toLocaleTimeString();
    }
}

/**
 * Format relative time (e.g., "2 hours ago")
 */
export function formatRelativeTime(utcString: string | null | undefined): string {
    if (!utcString) return '';

    const date = new Date(utcString);
    if (isNaN(date.getTime())) return utcString;

    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins}m ago`;

    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;

    const diffDays = Math.floor(diffHours / 24);
    if (diffDays < 7) return `${diffDays}d ago`;

    return formatDate(utcString);
}

/**
 * React hook to get formatted datetime with user's preference
 */
import { useSettings } from '@/contexts/SettingsContext';

export function useFormattedDateTime() {
    const settings = useSettings();
    const timeFormat = settings.time_format || 'auto';
    const dateFormat = settings.date_format || 'auto';
    const timezone = settings.timezone || 'auto';

    const getOptions = (baseOptions?: Intl.DateTimeFormatOptions): Intl.DateTimeFormatOptions => {
        const opts = { ...baseOptions };
        if (timezone && timezone !== 'auto') {
            opts.timeZone = timezone;
        }
        return opts;
    };

    return {
        formatDateTime: (utcString: string | null | undefined, options?: Intl.DateTimeFormatOptions) =>
            formatDateTime(utcString, timeFormat, dateFormat, getOptions(options)),
        formatDate: (utcString: string | null | undefined, options?: Intl.DateTimeFormatOptions) =>
            formatDate(utcString, dateFormat, getOptions(options)),
        formatTime: (utcString: string | null | undefined, options?: Intl.DateTimeFormatOptions) =>
            formatTime(utcString, timeFormat, getOptions(options)),
        formatRelativeTime: (utcString: string | null | undefined) =>
            formatRelativeTime(utcString),
        currentTimeFormat: timeFormat,
        currentDateFormat: dateFormat,
        currentTimezone: timezone
    };
}

/**
 * Format a date string (YYYY-MM-DD) to the user's preferred display format
 * e.g., 2023-01-31 -> 31.01.2023 (if 'ch')
 */
export function formatDisplayDate(
    isoDateString: string,
    format: 'auto' | 'us' | 'eu' | 'iso' | 'ch' = 'auto'
): string {
    if (!isoDateString) return '';
    // Handle full ISO strings (e.g. 2023-01-01T12:00:00)
    const dateOnly = isoDateString.split('T')[0];
    const [year, month, day] = dateOnly.split('-').map(Number);

    if (!year || !month || !day) return isoDateString;

    switch (format) {
        case 'ch':
            return `${String(day).padStart(2, '0')}.${String(month).padStart(2, '0')}.${year}`;
        case 'eu':
            return `${String(day).padStart(2, '0')}/${String(month).padStart(2, '0')}/${year}`;
        case 'us':
            return `${String(month).padStart(2, '0')}/${String(day).padStart(2, '0')}/${year}`;
        case 'iso':
            return dateOnly;
        default: {
            // Auto: use browser locale
            const date = new Date(isoDateString);
            if (isNaN(date.getTime())) return isoDateString;
            return new Intl.DateTimeFormat(undefined).format(date);
        }
    }
}

/**
 * Parse a user input string into YYYY-MM-DD format based on preference
 */
export function parseInputDate(
    input: string,
    format: 'auto' | 'us' | 'eu' | 'iso' | 'ch' = 'auto'
): string | null {
    if (!input) return null;
    const cleanInput = input.trim();

    // Helper to validate and return ISO string
    const toISO = (y: number, m: number, d: number) => {
        const date = new Date(y, m - 1, d);
        if (date.getFullYear() === y && date.getMonth() === m - 1 && date.getDate() === d) {
            return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
        }
        return null;
    };

    // Regex matchers
    if (format === 'ch' || format === 'eu') {
        // Match DD.MM.YYYY or DD/MM/YYYY
        // Allow dot or slash separator
        const parts = cleanInput.match(/^(\d{1,2})[./](\d{1,2})[./](\d{4})$/);
        if (parts) {
            return toISO(parseInt(parts[3]), parseInt(parts[2]), parseInt(parts[1]));
        }
    }

    if (format === 'us') {
        // Match MM/DD/YYYY
        const parts = cleanInput.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
        if (parts) {
            return toISO(parseInt(parts[3]), parseInt(parts[1]), parseInt(parts[2]));
        }
    }

    if (format === 'iso') {
        const parts = cleanInput.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
        if (parts) {
            return toISO(parseInt(parts[1]), parseInt(parts[2]), parseInt(parts[3]));
        }
    }

    if (format === 'auto') {
        // Try reasonably unambiguous formats
        // ISO
        if (/^\d{4}-\d{2}-\d{2}$/.test(cleanInput)) return cleanInput;
        // If it parses natively OK
        const d = new Date(cleanInput);
        if (!isNaN(d.getTime())) {
            return d.toISOString().split('T')[0];
        }
    }

    return null;
}
