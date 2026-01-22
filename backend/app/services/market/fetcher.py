import asyncio
import logging
from datetime import date
from decimal import Decimal
from typing import List, Dict
import yfinance as yf
import pandas as pd

from .config import MarketDataConfig
from app.math_utils import sanitize_decimal

logger = logging.getLogger(__name__)


class RateFetcher:
    def __init__(self):
        self._yf_lock = asyncio.Lock()
        self._backoff_until = 0

    async def fetch_current_rates(self, tickers: List[str]) -> Dict[str, Decimal]:
        """Fetch current rates for a list of tickers."""
        if not tickers:
            return {}

        import time
        now = time.time()
        if now < self._backoff_until:
            wait_mins = int((self._backoff_until - now) / 60)
            logger.warning(f"Yahoo Finance rate limited. Backing off for {wait_mins} more minutes.")
            return {}

        from app.services.monitoring import get_monitor
        monitor = get_monitor()
        start_time = time.time()

        try:
            loop = asyncio.get_event_loop()

            # Run blocking yf.download in executor
            data = await asyncio.wait_for(
                loop.run_in_executor(
                    None,
                    lambda: yf.download(
                        tickers,
                        period="1d",
                        interval="1m",
                        progress=False,
                        timeout=MarketDataConfig.YFINANCE_TIMEOUT,
                    ),
                ),
                timeout=MarketDataConfig.TOTAL_FETCH_TIMEOUT,
            )

            latency = (time.time() - start_time) * 1000

            if data.empty:
                # Check for rate limit indicators in logs or empty response
                # yfinance often logs RateLimitError or returns empty DF
                logger.warning("Empty data returned from yfinance")
                monitor.update_component_status(
                    "Market Data",
                    "Online",
                    details={
                        "latency": f"{latency:.2f}ms",
                        "status": "empty_response",
                        "source": "rate_fetcher",
                    },
                )
                return {}

            monitor.update_component_status(
                "Market Data",
                "Online",
                details={"latency": f"{latency:.2f}ms", "source": "rate_fetcher"},
            )

            # Handle NaNs
            try:
                closes = data["Close"].ffill()
            except Exception:
                closes = data["Close"]

            results = {}

            row = None
            # Extract latest
            if len(tickers) == 1:
                # Series or scalar
                row = closes.iloc[-1]
                # If scalar, row is the value, if series row is value
            else:
                # DataFrame
                row = closes.iloc[-1]

            for ticker in tickers:
                try:
                    val = None
                    if len(tickers) == 1:
                        val = row
                    else:
                        if ticker in row:
                            val = row[ticker]

                    if val is not None:
                        if hasattr(val, "item"):
                            val = val.item()
                        rate = sanitize_decimal(val)
                        if rate and not rate.is_nan():
                            results[ticker] = rate
                except Exception as e:
                    logger.debug(f"Error extracting rate for {ticker}: {e}")

            return results

        except Exception as e:
            latency = (time.time() - start_time) * 1000
            err_msg = str(e)
            
            # Detect Rate Limit
            if "too many requests" in err_msg.lower() or "rate limit" in err_msg.lower():
                # backoff for 15 minutes
                self._backoff_until = time.time() + (15 * 60)
                logger.error("Yahoo Finance Rate Limit detected. Backing off for 15 minutes.")
            
            logger.error(f"Failed to fetch current rates: {e}")
            monitor.update_component_status(
                "Market Data",
                "Degraded",
                details={
                    "latency": f"{latency:.2f}ms",
                    "error": str(e),
                    "source": "rate_fetcher",
                },
            )
            return {}

    async def fetch_historical_rates(
        self, tickers: List[str], start: date, end: date, interval: str = "1d"
    ) -> pd.DataFrame:
        """
        Fetch historical data. Returns raw DataFrame for flexible processing by service.
        """
        if not tickers:
            return pd.DataFrame()

        import time
        now = time.time()
        if now < self._backoff_until:
            wait_mins = int((self._backoff_until - now) / 60)
            logger.warning(f"Yahoo Finance rate limited. Skipping historical fetch for {wait_mins} more minutes.")
            return pd.DataFrame()

        try:
            loop = asyncio.get_event_loop()

            s_str = start.strftime("%Y-%m-%d")
            e_str = end.strftime("%Y-%m-%d")

            async with self._yf_lock:
                data = await asyncio.wait_for(
                    loop.run_in_executor(
                        None,
                        lambda: yf.download(
                            tickers,
                            start=s_str,
                            end=e_str,
                            interval=interval,
                            progress=False,
                            timeout=MarketDataConfig.YFINANCE_TIMEOUT,
                        ),
                    ),
                    timeout=MarketDataConfig.TOTAL_FETCH_TIMEOUT,
                )
            return data

        except Exception as e:
            err_msg = str(e)
            if "too many requests" in err_msg.lower() or "rate limit" in err_msg.lower():
                import time
                self._backoff_until = time.time() + (15 * 60)
                logger.error("Yahoo Finance Rate Limit detected during historical fetch. Backing off for 15 minutes.")
            
            logger.error(f"Failed to fetch historical rates: {e}")
            return pd.DataFrame()
