import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs))
}

const CRYPTO_SYMBOLS: Record<string, string> = {
    'BTC': '₿',
    'ETH': 'Ξ',
    'SOL': '◎',
    'USDT': '₮',
    'USDC': '$',
    'XRP': '✕',
    'ADA': '₳',
    'DOGE': 'Ð',
    'DOT': '●',
    'MATIC': 'ɱ',
    'LTC': 'Ł',
    'BNB': 'BNB',
    'NEXO': 'NEXO',
    'CRO': 'CRO',
    'CHF': 'CHF',
    'EUR': '€',
    'USD': '$',
    'GBP': '£',
    'CAD': 'CA$'
};

export function getCurrencySymbol(code: string): string | undefined {
    // Check crypto first
    if (CRYPTO_SYMBOLS[code]) {
        return CRYPTO_SYMBOLS[code];
    }

    try {
        return new Intl.NumberFormat('en-US', { style: 'currency', currency: code }).formatToParts(0).find(part => part.type === 'currency')?.value;
    } catch {
        return undefined;
    }
}

export function isValidCurrency(code: string): boolean {
    if (!code || (code.length !== 3 && code.length !== 4)) return false;

    // Allow known crypto
    if (CRYPTO_SYMBOLS[code]) return true;

    try {
        Intl.NumberFormat(undefined, { style: 'currency', currency: code });
        return true;
    } catch {
        return false;
    }
}

export function formatCurrency(
    value: number,
    code: string,
    maximumFractionDigits: number = 2,
    locale: string = 'en-US' // Default to US if not provided
): string {
    // Map internal setting values to actual locales
    let actualLocale = locale;
    if (locale === 'us' || locale === 'auto' || !locale) actualLocale = 'en-US';
    else if (locale === 'eu') actualLocale = 'de-DE'; // Germany uses 1.234,56
    else if (locale === 'ch') actualLocale = 'de-CH'; // Swiss uses 1'234.56

    // For crypto and fallback symbols
    const symbol = getCurrencySymbol(code);

    try {
        // If we have a valid ISO code that Intl supports, let it handle everything
        // unless it's a crypto or special symbol we manage manually
        if (!symbol || symbol === code || symbol === '$' || symbol === '€' || symbol === '£' || symbol === 'CHF' || symbol === 'CA$') {
            return new Intl.NumberFormat(actualLocale, {
                style: 'currency',
                currency: code,
                minimumFractionDigits: maximumFractionDigits === 0 ? 0 : 2,
                maximumFractionDigits: maximumFractionDigits
            }).format(value);
        }

        // Manual formatting for custom symbols (Crypto etc)
        const formattedValue = new Intl.NumberFormat(actualLocale, {
            minimumFractionDigits: maximumFractionDigits === 0 ? 0 : 2,
            maximumFractionDigits: maximumFractionDigits
        }).format(value);

        return `${symbol} ${formattedValue}`;
    } catch {
        // Fallback for non-ISO codes or errors
        const fallbackSymbol = getCurrencySymbol(code) || code;
        const formattedValue = new Intl.NumberFormat('en-US', { // Fallback to US
            minimumFractionDigits: maximumFractionDigits === 0 ? 0 : 2,
            maximumFractionDigits: maximumFractionDigits
        }).format(value);
        return `${fallbackSymbol} ${formattedValue}`;
    }
}

export function getFaviconUrl(url: string, size: number = 64): string | null {
    if (!url) return null;
    try {
        const domain = new URL(url.startsWith('http') ? url : `https://${url}`).hostname;
        return `https://www.google.com/s2/favicons?domain=${domain}&sz=${size}`;
    } catch {
        return null;
    }
}

export function formatDate(
    date: Date | string | null | undefined,
    dateFormat: string = 'auto',
    timeFormat: string = 'auto'
): string {
    if (!date) return '-';

    const d = new Date(date);
    if (isNaN(d.getTime())) return 'Invalid Date';

    let locale = 'default';
    const options: Intl.DateTimeFormatOptions = {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
    };

    // Date Format Logic
    switch (dateFormat) {
        case 'us':
            locale = 'en-US';
            break;
        case 'eu':
            locale = 'en-GB'; // DD/MM/YYYY
            break;
        case 'ch':
            locale = 'de-CH'; // DD.MM.YYYY
            break;
        case 'iso':
            locale = 'en-CA'; // YYYY-MM-DD (closest standard locale)
            break;
        default:
            locale = navigator.language || 'en-US';
    }

    // Time Format Logic
    if (timeFormat === '12h') {
        // Force 12h format
        options.hour12 = true;
    } else if (timeFormat === '24h') {
        // Force 24h format
        options.hour12 = false;
    }
    // 'auto' leaves it to locale default

    try {
        const datePart = new Intl.DateTimeFormat(locale, {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit'
        }).format(d);

        const timePart = new Intl.DateTimeFormat(locale, {
            hour: '2-digit',
            minute: '2-digit',
            hour12: options.hour12
        }).format(d);

        return `${datePart} ${timePart}`;
    } catch {
        return d.toLocaleString().replace(',', '');
    }
}
