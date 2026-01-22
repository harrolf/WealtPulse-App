import yfinance as yf
from typing import Dict, Optional, Literal
from decimal import Decimal
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from .. import models
import logging
from app.utils.datetime_utils import utc_now

logger = logging.getLogger(__name__)


class PriceService:
    """Service for fetching and updating asset prices"""

    @staticmethod
    async def fetch_price(ticker: str, source: Literal["fresh", "cache"] = "cache") -> Optional[Dict]:
        """
        Fetch current price for a single ticker.
        
        Args:
            ticker: Asset ticker symbol
            source: 
                - "fresh": Fetch from Yahoo Finance (Agents/User Request)
                - "cache": Query from database (default for API)
        """
        if source == "fresh":
            return await PriceService._fetch_price_from_yfinance(ticker)
        else:
            return await PriceService._fetch_price_from_db(ticker)

    @staticmethod
    async def _fetch_price_from_yfinance(ticker: str) -> Optional[Dict]:
        """Fetch from Yahoo Finance (Logic moved from original fetch_price)"""
        # Import here to avoid circular dependencies if any, though likely fine at top
        from .monitoring import get_monitor
        from .market.config import MarketDataConfig
        import time

        monitor = get_monitor()
        start_time = time.time()
        
        # Resolve Ticker (Handle Crypto suffix -USD)
        # We can reuse MarketDataConfig.resolve_ticker logic but specifically for Assets
        # Ideally we'd have a shared "resolve_asset_ticker" but utilizing CRYPTO_SET inline is safe
        
        query_ticker = ticker
        if ticker in MarketDataConfig.CRYPTO_SET and not ticker.endswith("-USD"):
            query_ticker = f"{ticker}-USD"
            
        # Also simple heuristic: if it's 3-4 chars and NOT a standard currency (which are 3 chars), 
        # and NOT in CRYPTO_SET, we might check if user intended crypto? 
        # For now, explicit Set + suffix check is safest.

        try:
            # Use download for more reliable data fetching
            data = yf.download(query_ticker, period="1d", progress=False)

            latency = (time.time() - start_time) * 1000

            if data.empty:
                logger.warning(f"No price data found for {ticker} (queried as {query_ticker})")
                # We don't mark as offline just because one ticker fails, but we record the attempt
                monitor.update_component_status(
                    "Market Data",
                    "Online",
                    details={
                        "latency": f"{latency:.2f}ms",
                        "last_ticker": ticker,
                        "status": "no_data",
                    },
                )
                return None

            # Get the most recent close price
            # Robust conversion to Decimal
            raw_price = data["Close"].iloc[-1]
            if hasattr(raw_price, "item"):
                raw_price = raw_price.item()  # Convert numpy type to python native
            
            # If sanitize_decimal is not available here, we'll use simple Decimal(str())
            # But let's check if we can import it or just do it inline
            price = Decimal(str(raw_price))

            monitor.update_component_status(
                "Market Data",
                "Online",
                details={"latency": f"{latency:.2f}ms", "source": "yfinance"},
            )

            return {
                "ticker": ticker,
                "price": price,
                "currency": "USD",  # yfinance prices are typically in USD
                "timestamp": utc_now(),
            }

        except Exception as e:
            latency = (time.time() - start_time) * 1000
            logger.error(f"Error fetching price for {ticker}: {str(e)}")
            monitor.update_component_status(
                "Market Data",
                "Degraded",
                details={"latency": f"{latency:.2f}ms", "error": str(e)},
            )
            return None

    @staticmethod
    async def _fetch_price_from_db(ticker: str) -> Optional[Dict]:
        """Query latest price from database."""
        # This requires a DB session. Since this is a static method usually called without a session 
        # (unless passed one), we need to handle session lifecycle if not provided.
        # Ideally, this should take a session, but fetch_price didn't take one before.
        # We'll create a local session.
        from app.database import SessionLocal
        async with SessionLocal() as db:
            stmt = (
                select(models.PriceHistory)
                .join(models.Asset)
                .where(models.Asset.ticker_symbol == ticker)
                .order_by(models.PriceHistory.date.desc())
                .limit(1)
            )
            result = await db.execute(stmt)
            price_record = result.scalars().first()
            
            if price_record:
                return {
                    "ticker": ticker,
                    "price": price_record.price, # Already Decimal from SQLAlchemy Numeric
                    "currency": price_record.currency,
                    "timestamp": price_record.date,
                    "source": "cache"
                }
            return None

    @staticmethod
    async def update_asset_prices(db: AsyncSession) -> Dict[str, int]:
        """
        Update prices for all assets with ticker symbols
        Returns dict with counts of successful/failed updates
        """
        stats = {"success": 0, "failed": 0, "skipped": 0}

        try:
            # Get all assets with ticker symbols that support pricing
            stmt = (
                select(models.Asset)
                .join(models.AssetType)
                .where(
                    models.Asset.ticker_symbol.isnot(None), 
                    models.AssetType.supports_pricing.is_(True)
                )
            )
            result = await db.execute(stmt)
            assets = result.scalars().all()

            logger.info(f"Updating prices for {len(assets)} assets (filtered by supports_pricing=True)")

            for asset in assets:
                if not asset.ticker_symbol:
                    stats["skipped"] += 1
                    continue

                # Fetch price FRESH from source
                price_data = await PriceService.fetch_price(asset.ticker_symbol, source="fresh")

                if price_data:
                    # Create price history entry
                    price_history = models.PriceHistory(
                        asset_id=asset.id,
                        date=price_data["timestamp"],
                        price=price_data["price"],
                        currency=price_data["currency"],
                        source="yfinance",
                    )
                    db.add(price_history)
                    stats["success"] += 1
                    logger.debug(
                        f"Updated price for {asset.ticker_symbol}: {price_data['price']} {price_data['currency']}"
                    )
                else:
                    stats["failed"] += 1

            await db.commit()
            logger.info(f"Price update complete: {stats}")

        except Exception as e:
            logger.error(f"Error updating asset prices: {str(e)}")
            await db.rollback()
            raise

        return stats

    @staticmethod
    async def get_latest_price(
        db: AsyncSession, asset_id: int
    ) -> Optional[models.PriceHistory]:
        """Get the most recent price for an asset"""
        result = await db.execute(
            select(models.PriceHistory)
            .where(models.PriceHistory.asset_id == asset_id)
            .order_by(models.PriceHistory.date.desc())
            .limit(1)
        )
        return result.scalar_one_or_none()
