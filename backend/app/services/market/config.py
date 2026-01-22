from decimal import Decimal
from datetime import timedelta
from typing import Dict, Set


class MarketDataConfig:
    # Timeouts
    LOCK_TIMEOUT = 10.0
    YFINANCE_TIMEOUT = 10.0
    TOTAL_FETCH_TIMEOUT = 15.0

    # Cache
    CACHE_DURATION = timedelta(minutes=15)

    # Retention
    HIGH_RES_LIMIT_DAYS = 7
    MEDIUM_RES_LIMIT_DAYS = 60

    # Fallback Rates (Decimal)
    FALLBACK_RATES: Dict[str, Decimal] = {
        "EUR": Decimal("1.09"),
        "GBP": Decimal("1.27"),
        "CHF": Decimal("1.12"),
        "CAD": Decimal("0.74"),
        "BTC": Decimal("94000.0"),
        "USD": Decimal("1.0"),
        "NEXO": Decimal("1.25"),
        "USDT": Decimal("1.00"),
        "CRO": Decimal("0.08"),
    }

    # Crypto Tickers
    CRYPTO_SET: Set[str] = {
        "BTC",
        "ETH",
        "SOL",
        "ADA",
        "DOT",
        "DOGE",
        "SHIB",
        "LINK",
        "UNI",
        "MATIC",
        "NEXO",
        "USDT",
        "CRO",
        "LTC",
        "XRP",
    }

    @staticmethod
    def resolve_ticker(currency: str) -> str | None:
        if not currency or not isinstance(currency, str) or currency.upper() in ["USD", "UNKNOWN", "-", ""]:
            return None

        # Already resolved?
        if currency.endswith("-USD") or currency.endswith("=X"):
            return currency

        # If it has a dot (e.g. EZJ.L, PHIA.NV), it's likely a specific stock ticker
        if "." in currency:
            return currency

        if currency in MarketDataConfig.CRYPTO_SET:
            return f"{currency}-USD"

        if len(currency) == 3:
            return f"{currency}USD=X"

        # Special cases for eToro tickers that might need cleanup before querying Yahoo
        # e.g. EZJ.L-USD should probably just be EZJ.L if it's already a valid Yahoo ticker
        if "-" in currency and not currency.endswith("-USD"):
            # If it already has a dash but it's not our suffix, it might be a composite ticker
            # Just return as is or attempt to validate
            pass

        return f"{currency}-USD"
