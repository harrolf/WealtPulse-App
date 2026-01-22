import logging
import datetime
import math
from decimal import Decimal
from typing import List, Dict, Optional
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError

from app.database import SessionLocal
from app.models import ExchangeRateHistory

logger = logging.getLogger(__name__)


class MarketDataPersistence:
    @staticmethod
    async def save_rates(rates: Dict[str, Decimal], timestamp: datetime.datetime):
        """Save current rates to history."""
        async with SessionLocal() as session:
            try:
                # We use a primitive validation here, but caller should ideally validate too
                for curr, rate in rates.items():
                    if curr == "USD":
                        continue

                    # Validation Logic
                    is_invalid = False
                    if rate is None:
                        is_invalid = True
                    elif isinstance(rate, Decimal):
                         if rate.is_nan() or rate.is_infinite() or rate <= 0:
                              is_invalid = True
                    else:
                         # Float
                         if math.isnan(rate) or math.isinf(rate) or rate <= 0:
                              is_invalid = True

                    if is_invalid:
                        logger.warning(
                            f"Skipping persistence for {curr}: Invalid rate {rate}"
                        )
                        continue

                    hist = ExchangeRateHistory(
                        currency=curr,
                        rate=float(
                            rate
                        ),  # DB likely stores Float, or we need to migrate DB to Numeric
                        timestamp=timestamp,
                    )
                    session.add(hist)
                await session.commit()
            except Exception as e:
                logger.error(f"Failed to save rates history: {e}")

    @staticmethod
    async def save_history_batch(records: List[Dict], upsert: bool = False):
        """
        Save a batch of historical records.
        
        Args:
            records: List of records to save
            upsert: If True, overwrite existing records (Delete then Insert).
                    If False, attempt to insert and ignore duplicates (or fail batch).
        """
        if not records:
            return

        from sqlalchemy import delete
        
        # Group by currency for efficient deletion optimization if needed, 
        # but for simplicity/robustness, we can delete by (currency, timestamp) in bulk or range.
        # Given batches can be large, range delete is risky if records are sparse.
        
        # Optimized approach: Identify Range per currency in the batch
        # Map: Currency -> {min_ts, max_ts, set_of_timestamps}
        ranges = {}
        for r in records:
            c = r["currency"]
            ts = r["timestamp"]
            if c not in ranges:
                ranges[c] = {"min": ts, "max": ts, "timestamps": {ts}}
            else:
                ranges[c]["min"] = min(ranges[c]["min"], ts)
        # Map: Currency -> {min_ts, max_ts, set_of_timestamps}
        ranges = {}
        for r in records:
            c = r["currency"]
            ts = r["timestamp"]
            if c not in ranges:
                ranges[c] = {"min": ts, "max": ts, "timestamps": {ts}}
            else:
                ranges[c]["min"] = min(ranges[c]["min"], ts)
                ranges[c]["max"] = max(ranges[c]["max"], ts)
                ranges[c]["timestamps"].add(ts)

        async with SessionLocal() as session:
            try:
                to_add_models = []
                
                # 1. DELETE existing records that collide (ONLY IF UPSERT)
                if upsert:
                    for currency, info in ranges.items():
                        timestamps = list(info["timestamps"])
                        chunk_size = 500
                        for i in range(0, len(timestamps), chunk_size):
                            chunk = timestamps[i:i + chunk_size]
                            stmt = delete(ExchangeRateHistory).where(
                                ExchangeRateHistory.currency == currency,
                                ExchangeRateHistory.timestamp.in_(chunk)
                            )
                            await session.execute(stmt)
                    
                    # All records are "new" now (since we deleted collisions)
                    for r in records:
                         to_add_models.append(
                            ExchangeRateHistory(
                                currency=r["currency"],
                                rate=float(r["rate"]),
                                timestamp=r["timestamp"],
                            )
                        )

                else:
                    # 2. FILTER existing records (If NOT Upsert)
                    # We must avoid IntegrityError by checking first
                    existing_keys = set()
                    for currency, info in ranges.items():
                        # Fetch all timestamps for this currency in the range
                        stmt = select(ExchangeRateHistory.timestamp).where(
                            ExchangeRateHistory.currency == currency,
                            ExchangeRateHistory.timestamp >= info["min"],
                            ExchangeRateHistory.timestamp <= info["max"]
                        )
                        result = await session.execute(stmt)
                        found = result.scalars().all()
                        for ts in found:
                            existing_keys.add((currency, ts))
                    
                    for r in records:
                        key = (r["currency"], r["timestamp"])
                        if key not in existing_keys:
                             to_add_models.append(
                                ExchangeRateHistory(
                                    currency=r["currency"],
                                    rate=float(r["rate"]),
                                    timestamp=r["timestamp"],
                                )
                            )

                # 3. INSERT
                if to_add_models:
                    session.add_all(to_add_models)
                    await session.commit()
                    
                count = len(to_add_models)
                count_msg = "Upsert" if upsert else "Insert"
                if count > 0:
                    logger.info(f"Saved {count} historical rates ({count_msg}).")
                return count

            except IntegrityError:
                logger.warning("Batch persistence failed (IntegrityError). Falling back to row-by-row safe saving.")
                
                # Fallback: Save one by one to ensure valid records are stored
                saved_count = 0
                # Re-open a clean session for the fallback
                async with SessionLocal() as fallback_session:
                    for r in records:
                        try:
                            # Try insert
                            hist = ExchangeRateHistory(
                                currency=r["currency"],
                                rate=float(r["rate"]),
                                timestamp=r["timestamp"],
                            )
                            fallback_session.add(hist)
                            await fallback_session.commit()
                            saved_count += 1
                        except IntegrityError:
                            # This specific record exists/collides. Skip it.
                            await fallback_session.rollback()
                            continue
                        except Exception:
                            # Other error?
                            await fallback_session.rollback()
                            # logger.debug(f"Row save error: {e}") 
                            continue

                logger.info(f"Fallback saved {saved_count}/{len(records)} records.")
                return saved_count
            except Exception as e:
                logger.error(f"Failed to save history batch: {e}")
                return 0

    @staticmethod
    async def get_latest_rates_in_range(
        currencies: List[str], start: datetime.datetime, end: datetime.datetime
    ) -> Dict[str, Decimal]:
        """Get latest available rate for each currency within the time range."""
        rates = {}
        async with SessionLocal() as session:
            try:
                stmt = (
                    select(ExchangeRateHistory)
                    .where(
                        ExchangeRateHistory.currency.in_(currencies),
                        ExchangeRateHistory.timestamp >= start,
                        ExchangeRateHistory.timestamp <= end,
                    )
                    .order_by(ExchangeRateHistory.timestamp.desc())
                )

                result = await session.execute(stmt)
                records = result.scalars().all()

                for r in records:
                    if r.currency not in rates:
                        from app.math_utils import sanitize_decimal

                        rates[r.currency] = sanitize_decimal(r.rate)
            except Exception as e:
                logger.error(f"DB Read Error (latest rates): {e}")
        return rates

    @staticmethod
    async def get_rates_series(
        currencies: List[str], start: datetime.datetime, end: datetime.datetime
    ) -> List[ExchangeRateHistory]:
        """Get raw history records for series plotting."""
        async with SessionLocal() as session:
            try:
                stmt = (
                    select(ExchangeRateHistory)
                    .where(
                        ExchangeRateHistory.currency.in_(currencies),
                        ExchangeRateHistory.timestamp >= start,
                        ExchangeRateHistory.timestamp <= end,
                    )
                    .order_by(ExchangeRateHistory.timestamp.asc())
                )

                result = await session.execute(stmt)
                return result.scalars().all()
            except Exception as e:
                logger.error(f"DB Read Error (series): {e}")
                return []
    @staticmethod
    async def get_earliest_record(currency: str) -> Optional[ExchangeRateHistory]:
        """Get the oldest available record for a currency."""
        async with SessionLocal() as session:
            try:
                stmt = (
                    select(ExchangeRateHistory)
                    .where(ExchangeRateHistory.currency == currency)
                    .order_by(ExchangeRateHistory.timestamp.asc())
                    .limit(1)
                )
                result = await session.execute(stmt)
                return result.scalars().first()
            except Exception as e:
                logger.error(f"DB Read Error (earliest): {e}")
                return None
