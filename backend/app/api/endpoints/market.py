from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from datetime import date, timedelta
import logging
from app.database import get_db
from ...models import User
from ..deps import get_effective_user_id
from ...services.market import get_market_data
from pydantic import BaseModel
from typing import Dict, List, Optional

from ...math_utils import sanitize_float
from decimal import Decimal

router = APIRouter()
logger = logging.getLogger(__name__)



# Constants for period mapping
PERIOD_DAYS = {
    "1d": 1,
    "5d": 5,
    "7d": 7,
    "1wk": 7,
    "1mo": 30,
    "3mo": 90,
    "6mo": 180,
    "1y": 365,
    "2y": 730,
    "5y": 1825,
    "ytd": 365,
    "max": 3650,  # Approximate
}

MINIMUM_RATE = Decimal("0.0001")  # Minimum rate to prevent division by zero


# Response Models
class RatesResponse(BaseModel):
    base_currency: str
    rates: Dict[str, float]
    last_updated: Optional[str]


class HistoryPoint(BaseModel):
    date: str
    value: float


class TrendsResponse(BaseModel):
    base_currency: str
    trends: Dict[str, Dict[str, Optional[float]]]
    last_updated: Optional[str]


# Helper Functions
def generate_flat_history(days: int = 30, value: float = 1.0) -> List[Dict[str, any]]:
    """Generate a flat-line history for same-currency comparisons."""
    today = date.today()
    return [
        {"date": (today - timedelta(days=days - i)).isoformat(), "value": value}
        for i in range(days)
    ]


@router.get("/rates", response_model=RatesResponse)
async def get_rates(
    db: AsyncSession = Depends(get_db), user_id: int = Depends(get_effective_user_id)
) -> RatesResponse:
    """
    Get exchange rates for all configured currencies,
    normalized to the user's main currency.
    Example: if Main is CHF, returns value of 1 USD in CHF, 1 EUR in CHF, etc.
    """
    # 1. Get user settings for currencies
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalars().first()

    settings = user.settings if user and user.settings else {}
    main_currency = settings.get("main_currency", "CHF")

    # We want rates for all currencies the user is interested in (managed + main)
    managed_currencies = settings.get("currencies") or []

    # Ensure main currency is in the list to fetch and filter out None/Empty
    unique_currencies = set([main_currency] + managed_currencies + ["USD"])
    currencies_to_fetch = [c for c in unique_currencies if c]

    market_data = get_market_data()

    # These rates are all relative to USD (e.g. "EUR": 1.08 means 1 EUR = 1.08 USD)
    raw_rates = await market_data.get_rates(currencies_to_fetch)

    # 2. Normalize to Main Currency
    # We want: How much is 1 {Currency} worth in {MainCurrency}?
    # Formula: Rate_in_Main = Rate_in_USD(Currency) / Rate_in_USD(MainCurrency)

    main_in_usd = raw_rates.get(main_currency, Decimal("1.0"))

    # Validate main_in_usd to prevent division by zero
    if main_in_usd < MINIMUM_RATE:
        logger.warning(
            f"Invalid rate for {main_currency}: {main_in_usd}, using 1.0 as fallback"
        )
        main_in_usd = Decimal("1.0")

    normalized_rates = {}
    for code, rate_in_usd in raw_rates.items():
        normalized_rates[code] = sanitize_float(rate_in_usd / main_in_usd)

    return RatesResponse(
        base_currency=main_currency,
        rates=normalized_rates,
        last_updated=market_data.get_last_update_time(),
    )


@router.get("/history/{currency}", response_model=List[HistoryPoint])
async def get_currency_history_endpoint(
    currency: str,
    period: str = "1mo",
    db: AsyncSession = Depends(get_db),
    user_id: int = Depends(get_effective_user_id),
) -> List[HistoryPoint]:
    """
    Get historical exchange rate of {currency} relative to main_currency.
    """
    if period not in PERIOD_DAYS:
        period = "1mo"

    days = PERIOD_DAYS[period]

    # 1. Get Main Currency
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalars().first()
    settings = user.settings if user and user.settings else {}
    main_currency = settings.get("main_currency", "CHF")

    market_data = get_market_data()

    # Special Case: Target == Main -> Always 1.0 (Flat Line)
    if currency == main_currency:
        return generate_flat_history(days=days, value=1.0)

    # 2. Fetch Histories
    # We need Target vs USD and Main vs USD
    target_history = await market_data.get_currency_history(currency, period)

    if main_currency == "USD":
        # Simple case, just return target history (if target!=USD)
        # If target is USD, asking for USD vs USD history -> always 1.0
        if currency == "USD":
            return generate_flat_history(days=days, value=1.0)
        else:
            final_history = [
                {"date": d, "value": sanitize_float(val)}
                for d, val in target_history.items()
                if sanitize_float(val) is not None
            ]
            # Sort by date
            final_history.sort(key=lambda x: x["date"])
            return final_history

    # Complex case: Main is not USD (e.g. CHF)
    # We need Main vs USD history to normalize
    main_history = await market_data.get_currency_history(main_currency, period)

    # Special Case: Target IS USD (and Main is NOT USD)
    # We want USD in CHF => 1.0 / CHF(USD)
    if currency == "USD":
        final_history = []
        # Sort main history by date
        sorted_main = sorted(main_history.items())
        for d, m_val in sorted_main:
            if m_val and m_val > MINIMUM_RATE:
                try:
                    # Invert: Rate = 1 / MainRate
                    rate = Decimal("1.0") / m_val
                    sanitized = sanitize_float(rate)
                    if sanitized is not None:
                        final_history.append({"date": d, "value": sanitized})
                except Exception:
                    continue
        return final_history

    # 3. Align and Calculate Cross Rate
    # Rate = Target(USD) / Main(USD)

    # 3. Align and Calculate Cross Rate
    # Rate = Target(USD) / Main(USD)
    
    # IMPROVED LOGIC: Allow mixing resolutions (e.g. 1h Target vs 1d Main)
    # 1. Build Lookup Maps for Main Currency
    main_exact_map = {k: v for k, v in main_history.items()}
    main_date_map = {}
    for k, v in main_history.items():
        # k is iso string. Extract YYYY-MM-DD (first 10 chars)
        if len(k) >= 10:
            main_date_map[k[:10]] = v

    final_history = []
    
    # We iterate through TARGET keys (since that's the shape we want to show)
    sorted_target_keys = sorted(target_history.keys())

    logger.debug(
        f"calculating cross rates for {len(sorted_target_keys)} points. Main currency availability: {len(main_history)} points."
    )

    for d in sorted_target_keys:
        t_val = target_history[d]
        
        # 1. Try exact match
        m_val = main_exact_map.get(d)
        
        # 2. If missing, try date match (Fallback to daily rate for high-res target)
        if m_val is None and len(d) >= 10:
             m_val = main_date_map.get(d[:10])
             
        # 3. Last Resort: Forward Fill? (Optional, maybe too risky/complex for now)
        
        if t_val is not None and m_val is not None:
            try:
                t_dec = Decimal(str(t_val))
                m_dec = Decimal(str(m_val))

                if m_dec > Decimal(str(MINIMUM_RATE)):
                    rate = t_dec / m_dec
                    sanitized = sanitize_float(rate)
                    if sanitized is not None:
                        final_history.append({"date": d, "value": sanitized})
            except Exception:
                continue

    return final_history


@router.get("/trends", response_model=TrendsResponse)
async def get_currency_trends(
    currencies: str = Query(None, description="Comma separated list of currencies"),
    db: AsyncSession = Depends(get_db),
    user_id: int = Depends(get_effective_user_id),
) -> TrendsResponse:
    """
    Get trend data (percentage change) for 1d, 1w, 1m, 1y.
    """
    # 1. Get user settings
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalars().first()
    settings = user.settings if user and user.settings else {}
    main_currency = settings.get("main_currency", "CHF")

    # 2. Determine currencies to fetch
    if currencies:
        target_currencies = [
            c.strip().upper() for c in currencies.split(",") if c.strip()
        ]
    else:
        # Default: All managed + main + secondary
        managed = settings.get("currencies") or []
        secondary = settings.get("secondary_currencies") or []
        target_currencies = list(set(managed + secondary + [main_currency]))

    market_data = get_market_data()

    # 3. Get Trends relative to Main Currency
    trends = await market_data.get_currency_trends(target_currencies, main_currency)

    # Sanitize trends
    sanitized_trends = {}
    for ticker, periods in trends.items():
        sanitized_trends[ticker] = {}
        for period, change in periods.items():
            sanitized_trends[ticker][period] = sanitize_float(change)

    return TrendsResponse(
        base_currency=main_currency,
        trends=sanitized_trends,
        last_updated=market_data.get_last_update_time(),
    )
