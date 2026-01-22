import asyncio
import logging
import datetime
from decimal import Decimal
from typing import Dict, List, Optional, Any, Literal
import pandas as pd
from sqlalchemy import select
from app.database import SessionLocal
from app.models import ExchangeRateHistory

from .config import MarketDataConfig
from .persistence import MarketDataPersistence
from .fetcher import RateFetcher
from app.utils.datetime_utils import utc_now

logger = logging.getLogger(__name__)


class MarketDataService:
    _instance = None

    def __init__(self):
        self._rates_cache: Dict[str, Decimal] = {}
        self._last_update: Optional[datetime.datetime] = None
        self._locks: Dict[str, asyncio.Lock] = {}
        self._locks_lock = asyncio.Lock()  # Protects dictionary access

        self._fetcher = RateFetcher()
        self._using_fallbacks = False

        # Initialize Config
        from app.core.config import settings

        self._config = {
            "use_mock_data": settings.USE_MOCK_DATA,  # Though we removed mock logic for brevity/production focus
            "retention": {
                "high_res_limit_days": MarketDataConfig.HIGH_RES_LIMIT_DAYS,
                "medium_res_limit_days": MarketDataConfig.MEDIUM_RES_LIMIT_DAYS,
            },
        }

    async def _get_lock(self, key: str) -> asyncio.Lock:
        async with self._locks_lock:
            if key not in self._locks:
                self._locks[key] = asyncio.Lock()
            return self._locks[key]

    @classmethod
    def get_instance(cls):
        if cls._instance is None:
            cls._instance = cls()
        return cls._instance

    def get_config(self) -> Dict[str, Any]:
        """Get current configuration."""
        return self._config

    def update_config(self, new_config: Dict[str, Any]):
        """Update service configuration dynamically."""
        if not new_config:
            return

        # Simple top-level merge
        for k, v in new_config.items():
            if k == "retention" and isinstance(v, dict):
                # Ensure retention sub-keys are handled
                if "retention" not in self._config:
                    self._config["retention"] = {}
                for rk, rv in v.items():
                    self._config["retention"][rk] = rv
            else:
                self._config[k] = v

        logger.info(f"Market Data Service config updated: {self._config}")

    def _should_refresh(self) -> bool:
        if not self._last_update:
            return True
        return utc_now() - self._last_update > MarketDataConfig.CACHE_DURATION

    async def get_rates(
        self, currencies: List[str], source: Literal["fresh", "cache"] = "cache"
    ) -> Dict[str, Decimal]:
        """
        Get exchange rates for given currencies against USD.
        
        Args:
            currencies: List of currency codes
            source: 
                - "fresh": Force fetch from Yahoo Finance (Agents only)
                - "cache": Query from database (default for API/Services)
        """
        rates = {"USD": Decimal("1.0")}
        to_fetch = [c for c in currencies if c != "USD"]
        
        if not to_fetch:
            return rates

        if source == "fresh":
            return await self._fetch_fresh_rates(to_fetch, rates)
        else:
            return await self._get_rates_from_db(to_fetch, rates)

    async def _get_rates_from_db(self, currencies: List[str], rates: Dict[str, Decimal]) -> Dict[str, Decimal]:
        """Query latest rates from database."""
        async with SessionLocal() as db:
            # We want the LATEST rate for each currency
            # Since SQL doesn't have a simple "last for each" in one fast query without window functions,
            # and the list of currencies is usually small (5-10), we can just query efficiently.
            
            # Optimization: Fetch all latest entries in one go if possible, or loop if list is small.
            # Using window function for efficiency if list is larger, but for <20 currencies, a list of latest is fast.
            
            # Use a window function approach to get latest for the requested list
            # (Loop implementation below for simplicity/safety)
            
            for currency in currencies:
                stmt = (
                    select(ExchangeRateHistory)
                    .where(ExchangeRateHistory.currency == currency)
                    .order_by(ExchangeRateHistory.timestamp.desc())
                    .limit(1)
                )
                result = await db.execute(stmt)
                record = result.scalars().first()
                
                if record and record.rate:
                    from app.math_utils import sanitize_decimal
                    rates[currency] = sanitize_decimal(record.rate)
                else:
                    # Fallback
                    rates[currency] = MarketDataConfig.FALLBACK_RATES.get(currency, Decimal("0.0"))
            
            return rates

    async def _fetch_fresh_rates(self, currencies: List[str], rates: Dict[str, Decimal]) -> Dict[str, Decimal]:
        """Fetch from Yahoo Finance and persist."""
        ticker_map = {}
        for c in currencies:
            ticker = MarketDataConfig.resolve_ticker(c)
            if ticker:
                ticker_map[c] = ticker

        if not ticker_map:
             return rates

        # 2. Lock and Fetch
        try:
            # Wait for lock
            async with self._locks_lock:
                if "global_fetch" not in self._locks:
                    self._locks["global_fetch"] = asyncio.Lock()
                fetch_lock = self._locks["global_fetch"]

            # Acquire fetch lock
            try:
                await asyncio.wait_for(
                    fetch_lock.acquire(), timeout=MarketDataConfig.LOCK_TIMEOUT
                )
            except asyncio.TimeoutError:
                logger.warning("Market fetch lock timeout in fresh mode")
                # Even in fresh mode, if we can't get lock, we might fail or try cache?
                # For safety, let's try to return what we have or error? 
                # Better to just proceed or fail. Let's fail gracefully to 0.0 or fallback.
                for c in currencies:
                     rates[c] = MarketDataConfig.FALLBACK_RATES.get(c, Decimal("0.0"))
                return rates

            try:
                logger.info(f"Fetching fresh rates for {len(currencies)} currencies")
                tickers_to_query = list(ticker_map.values())

                # Fetch
                new_rates_map = await self._fetcher.fetch_current_rates(
                    tickers_to_query
                )

                # Update Local Cache & Result
                timestamp = utc_now()
                self._last_update = timestamp
                self._using_fallbacks = False

                # Persist Queue
                persistence_data = {}

                for c in currencies:
                    ticker = ticker_map.get(c)
                    if ticker and ticker in new_rates_map:
                        rate = new_rates_map[ticker]
                        self._rates_cache[c] = rate
                        rates[c] = rate
                        persistence_data[c] = rate
                    else:
                        # Failed to fetch
                        if c in MarketDataConfig.FALLBACK_RATES:
                            rates[c] = MarketDataConfig.FALLBACK_RATES[c]
                        else:
                            rates[c] = Decimal("0.0")

                # Async save
                if persistence_data:
                    # Filter out 0.0 rates before saving
                    valid_persistence = {k: v for k, v in persistence_data.items() if v > 0}
                    if valid_persistence:
                        await MarketDataPersistence.save_rates(valid_persistence, timestamp)

            finally:
                fetch_lock.release()

        except Exception as e:
            logger.error(f"Fatal error in _fetch_fresh_rates: {e}")
            self._using_fallbacks = True
            for c in currencies:
                rates[c] = MarketDataConfig.FALLBACK_RATES.get(c, Decimal("0.0"))

        return rates

    async def get_historical_rates(
        self, target_date: datetime.date, currencies: List[str], source: Literal["fresh", "cache"] = "cache"
    ) -> Dict[str, Decimal]:
        """Get historical rates for a specific date."""
        if source == "fresh":
            # If fresh, we just use the range fetcher which uses yfinance underneath if missing
            # But get_historical_rates_range tries DB first normally.
            # To force fresh, we might need to bypass that or just trust the gap check?
            # Actually, current logic in get_historical_rates_range DOES check DB.
            # For simplicity, if source=fresh, we can call fetcher directly for this date.
            
            # Since backfill usually calls series/range, let's just use the range logic 
            # but maybe we should add source param there too? 
            # For now, let's keep it simple: If fresh is requested for a single date, fetch it.
            
            # ... Actually implementation detail: get_historical_rates just wraps range.
            pass

        res = await self.get_historical_rates_range([target_date], currencies)
        return res.get(target_date.isoformat(), {"USD": Decimal("1.0")})

    async def get_historical_rates_range(
        self, dates: List[datetime.date], currencies: List[str]
    ) -> Dict[str, Dict[str, Decimal]]:
        """
        Get historical rates for multiple dates and currencies in a batch.
        Returns: { "2023-01-01": { "EUR": 1.05, ... }, ... }
        """
        if not dates or not currencies:
            return {}

        start_date = min(dates)
        end_date = max(dates)

        # 1. Fetch ALL known records from DB for this range
        db_records = await MarketDataPersistence.get_rates_series(
            currencies,
            datetime.datetime.combine(
                start_date - datetime.timedelta(days=7), datetime.time.min
            ),
            datetime.datetime.combine(end_date, datetime.time.max),
        )

        # Organize DB records by date and currency
        db_cache = {}  # { date_str: { currency: rate } }
        for r in db_records:
            d_str = r.timestamp.date().isoformat()
            if d_str not in db_cache:
                db_cache[d_str] = {}
            from app.math_utils import sanitize_decimal

            db_cache[d_str][r.currency] = sanitize_decimal(r.rate)

        # 2. Check which date/currency pairs are missing
        needed_tickers = {}
        for c in currencies:
            if c == "USD":
                continue
            needed_tickers[c] = MarketDataConfig.resolve_ticker(c)

        missing_any = False
        for d in dates:
            d_str = d.isoformat()
            for c in currencies:
                if c == "USD":
                    continue
                if d_str not in db_cache or c not in db_cache[d_str]:
                    missing_any = True
                    break
            if missing_any:
                break

        if missing_any:
            unique_tickers = list(set([t for t in needed_tickers.values() if t]))
            if unique_tickers:
                logger.info(
                    f"Fetching range {start_date} to {end_date} from yfinance for {currencies}"
                )
                raw_df = await self._fetcher.fetch_historical_rates(
                    unique_tickers,
                    start_date - datetime.timedelta(days=7),
                    end_date + datetime.timedelta(days=1),
                )

                if not raw_df.empty:
                    try:
                        closes = raw_df["Close"].ffill()
                    except Exception:
                        closes = raw_df

                    records_to_save = []
                    for idx, row in closes.iterrows():
                        ts = pd.Timestamp(idx).to_pydatetime()
                        d_str = ts.date().isoformat()
                        if d_str not in db_cache:
                            db_cache[d_str] = {}

                        for c, ticker in needed_tickers.items():
                            if not ticker:
                                continue
                            val = None
                            if len(unique_tickers) == 1:
                                val = row
                            elif ticker in row:
                                val = row[ticker]

                            if val is not None:
                                from app.math_utils import sanitize_decimal

                                if hasattr(val, "item"):
                                    val = val.item()
                                rate = sanitize_decimal(val)
                                if rate and not rate.is_nan():
                                    db_cache[d_str][c] = rate
                                    records_to_save.append(
                                        {
                                            "currency": c,
                                            "rate": rate,
                                            "timestamp": ts,
                                            "is_available": True,
                                        }
                                    )

                    if records_to_save:
                        # Fresh data from API should overwrite existing stale records
                        await MarketDataPersistence.save_history_batch(records_to_save, upsert=True)

        # 3. Finalize result for requested dates
        result = {}
        for d in dates:
            d_str = d.isoformat()
            result[d_str] = {"USD": Decimal("1.0")}
            for c in currencies:
                if c == "USD":
                    continue
                val = db_cache.get(d_str, {}).get(c)
                if val is None:
                    # Look back up to 7 days
                    for i in range(1, 8):
                        prev_d = (d - datetime.timedelta(days=i)).isoformat()
                        val = db_cache.get(prev_d, {}).get(c)
                        if val is not None:
                            break

                result[d_str][c] = val or Decimal("0.0")

        return result

    async def get_historical_rates_series(
        self,
        start_date: datetime.date,
        end_date: datetime.date,
        currencies: List[str],
        interval: str = "1d",
        source: Literal["fresh", "cache"] = "cache",
    ) -> Dict[str, Dict[str, Decimal]]:
        """
        Get historical series (high res or daily) for backfill agent.
        Returns: { "ISO_TIMESTAMP": { "EUR": 1.05 } }
        For daily interval, this is similar to range but ensures we cover the full range from yfinance if missing.
        """
        if not currencies:
            return {}

        # If source is fresh, we skip DB check and go straight to fetcher
        if source == "fresh":
             return await self._fetch_historical_series_fresh(start_date, end_date, currencies, interval)

        # 1. Fetch ALL known records from DB for this range (Cache Path)
        start_dt = datetime.datetime.combine(start_date, datetime.time.min)
        end_dt = datetime.datetime.combine(end_date, datetime.time.max)
        
        db_records = await MarketDataPersistence.get_rates_series(
            currencies, start_dt, end_dt
        )
        
        result = {}
        for r in db_records:
            t_str = r.timestamp.isoformat()
            if t_str not in result:
                result[t_str] = {"USD": Decimal("1.0")}
            
            from app.math_utils import sanitize_decimal
            result[t_str][r.currency] = sanitize_decimal(r.rate)

        return result

    async def _fetch_historical_series_fresh(
        self,
        start_date: datetime.date,
        end_date: datetime.date,
        currencies: List[str],
        interval: str,
    ) -> Dict[str, Dict[str, Decimal]]:
        """Helper to fetch fresh historical data from API."""
        needed_tickers = {}
        for c in currencies:
            if c == "USD":
                continue
            needed_tickers[c] = MarketDataConfig.resolve_ticker(c)

        unique_tickers = list(set([t for t in needed_tickers.values() if t]))
        if not unique_tickers:
            return {}

        # Fetch
        raw_df = await self._fetcher.fetch_historical_rates(
            unique_tickers,
            start_date,
            end_date + datetime.timedelta(days=1),
            interval=interval,
        )

        result = {}
        if not raw_df.empty:
            try:
                closes = raw_df["Close"].ffill()
            except Exception:
                closes = raw_df

            for idx, row in closes.iterrows():
                ts = pd.Timestamp(idx).isoformat()
                result[ts] = {"USD": Decimal("1.0")}

                for c, ticker in needed_tickers.items():
                    if not ticker:
                        continue
                    val = None
                    if len(unique_tickers) == 1:
                        val = row
                    elif ticker in row:
                        val = row[ticker]

                    if val is not None:
                        from app.math_utils import sanitize_decimal

                        if hasattr(val, "item"):
                            val = val.item()
                        rate = sanitize_decimal(val)
                        if rate and not rate.is_nan():
                            result[ts][c] = rate
        return result

    async def get_currency_history(
        self, currency: str, period: str = "1mo"
    ) -> Dict[str, Decimal]:
        """Get historical data series for a currency."""
        if currency == "USD":
            return {}
        ticker = MarketDataConfig.resolve_ticker(currency)
        if not ticker:
            return {}

        # 1. Determine Date Range
        now_dt = utc_now()
        days = 30
        if "d" in period:
            days = int(period.replace("d", ""))
        elif "wk" in period:
            days = int(period.replace("wk", "")) * 7
        elif "mo" in period:
            days = int(period.replace("mo", "")) * 30
        elif "y" in period:
            days = int(period.replace("y", "")) * 365
        elif period == "max":
            days = 365 * 50

        start_date = (now_dt - datetime.timedelta(days=days)).date()
        if period == "max":
            start_date = datetime.date(1970, 1, 1)

        start_dt = datetime.datetime.combine(start_date, datetime.time.min)
        end_dt = datetime.datetime.combine(now_dt.date(), datetime.time.max)

        # 2. Fetch from DB
        history = {}
        # Fetch effectively from DB with high granularity if present
        # MarketDataPersistence.get_rates_series returns all points
        db_records = await MarketDataPersistence.get_rates_series(
            [currency], start_dt, end_dt
        )

        # Populate history dict
        for r in db_records:
            from app.math_utils import sanitize_decimal

            # High Res Logic: If viewing < 7 days, keep full timestamp
            if days <= 7:
                key = r.timestamp.isoformat()
            else:
                key = r.timestamp.strftime("%Y-%m-%d")  # Daily for long range

            # If multiple points map to same day in long range, this just takes last one (which is fine)
            history[key] = sanitize_decimal(r.rate)

        # 3. Gap Check (Simple: usage based)
        # If we have very few points compared to days, fetch
        expected_points = days * 0.5
        if len(history) < expected_points:
            logger.info(f"Gap detected for {currency} history. Fetching from API.")
            # Fetch
            df = await self._fetcher.fetch_historical_rates(
                [ticker], start_date, now_dt.date()
            )
            if not df.empty:
                # Process
                try:
                    closes = df["Close"]
                    if ticker in closes:
                        closes = closes[ticker]
                except Exception:
                    closes = df["Close"]

                # Persist
                records = []
                for idx, val in closes.items():  # idx is timestamp
                    ts = pd.Timestamp(idx).to_pydatetime()
                    d_key = ts.strftime("%Y-%m-%d")

                    from app.math_utils import sanitize_decimal

                    if hasattr(val, "item"):
                        val = val.item()
                    rate = sanitize_decimal(val)

                    if rate and not rate.is_nan():
                        history[d_key] = rate
                        records.append(
                            {
                                "currency": currency,
                                "rate": rate,
                                "timestamp": ts,
                                "is_available": True,
                            }
                        )

                if records:
                    await MarketDataPersistence.save_history_batch(records)

        return history

    async def get_currency_trends(
        self, currencies: List[str], base_currency: str = "USD"
    ) -> Dict[str, Dict[str, Decimal]]:
        """
        Get trend data (percentage change) for 1d, 1w, 1m, 1y.
        Returns: { "EUR": { "1d": 0.5, "1w": -1.2, ... }, ... }
        """
        trends = {}

        # 1. Fetch Current Rates (today)
        # Ensure base_currency is fetched so we can normalize correctly
        curr_list = list(set(currencies + [base_currency]))
        current_rates = await self.get_rates(curr_list)
        base_rate = current_rates.get(base_currency, Decimal("1.0"))

        # Normalize current rates to base
        normalized_current = {}
        for c, r in current_rates.items():
            if base_rate > Decimal("0.000001"):
                normalized_current[c] = r / base_rate
            else:
                normalized_current[c] = r

        # 2. Key timestamps for historical comparison
        now_dt = utc_now()
        target_dates = {
            "1d": now_dt - datetime.timedelta(days=1),
            "1w": now_dt - datetime.timedelta(weeks=1),
            "1m": now_dt - datetime.timedelta(days=30),
            "3m": now_dt - datetime.timedelta(days=90),
            "1y": now_dt - datetime.timedelta(days=365),
            "all": now_dt - datetime.timedelta(days=365 * 50), # Approx max history
        }

        # 3. Fetch Historical Data Point for each target date
        # Optimization: We could do a batch range query, but for now simple point checking is safer for logic migration
        # To be cleaner, we can use persistence.get_latest_rates_in_range or similar logic

        for p_name, t_date in target_dates.items():
            if p_name == "all": 
                continue # Handle separately

            # Get rates for that specific past date
            hist_rates = await self.get_historical_rates(t_date.date(), currencies)
            hist_base = hist_rates.get(base_currency, Decimal("1.0"))

            for c in currencies:
                if c not in trends: 
                    trends[c] = {}
                
                curr_val = normalized_current.get(c)
                raw_hist = hist_rates.get(c)

                if curr_val and raw_hist and hist_base > Decimal("0.000001"):
                    # Normalize Hist
                    hist_val = raw_hist / hist_base
                    
                    if hist_val > 0:
                        change = ((curr_val - hist_val) / hist_val) * 100
                        from app.math_utils import sanitize_decimal
                        trends[c][p_name] = sanitize_decimal(change)
                    else: 
                        trends[c][p_name] = None
                else: 
                    trends[c][p_name] = None

        # 4. Handle "ALL" (Max History) specifically
        # For each currency, find its earliest date, get base rate at that date, compare.
        for c in currencies:
            if c not in trends: 
                trends[c] = {}
            
            # Get earliest record
            earliest = await MarketDataPersistence.get_earliest_record(c)
            if not earliest:
                trends[c]["all"] = None
                continue
                
            # Get base rate at that specific past date
            # We use get_historical_rates which handles fallback/fetch if needed, 
            # though ideally we just want what's in DB for base at that time.
            base_hist_node = await self.get_historical_rates(earliest.timestamp.date(), [base_currency])
            base_val_at_start = base_hist_node.get(base_currency, Decimal("1.0"))
            
            if base_val_at_start < Decimal("0.000001"):
                base_val_at_start = Decimal("1.0")

            # Start Value Normalized
            start_val = Decimal(earliest.rate) / base_val_at_start
            curr_val = normalized_current.get(c)
            
            if start_val > 0 and curr_val:
                change = ((curr_val - start_val) / start_val) * 100
                from app.math_utils import sanitize_decimal
                trends[c]["all"] = sanitize_decimal(change)
            else:
                trends[c]["all"] = None

        return trends

    def get_last_update_time(self) -> Optional[str]:
        if self._last_update:
            if self._last_update.tzinfo is None:
                return self._last_update.replace(tzinfo=datetime.timezone.utc).isoformat()
            return self._last_update.isoformat()
        return None
