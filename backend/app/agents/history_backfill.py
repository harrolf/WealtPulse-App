import logging
import datetime
from typing import List, Optional
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from ..database import SessionLocal
from ..models import Asset, User
from app.services.market import get_market_data

from ..services.monitoring import get_monitor

from .base import BaseAgent

logger = logging.getLogger(__name__)


class HistoryBackfillAgent(BaseAgent):
    _instance = None
    name = "Market Data Backfill"
    description = "Backfills missing historical market rates for managed currencies."
    schedule_type = "manual"

    def __init__(self):
        super().__init__()
        self.market_data = get_market_data()
        self.monitor = get_monitor()

    @classmethod
    def get_instance(cls):
        if cls._instance is None:
            cls._instance = cls()
        return cls._instance

    async def execute(
        self,
        currency: Optional[str] = None,
        start_date: Optional[datetime.date | str] = None,
        end_date: Optional[datetime.date | str] = None,
        force: bool = False,
        agent_config: Optional[dict] = None,
        **kwargs,
    ):
        """
        Main entry point for the agent logic.
        """
        # Parse dates if strings
        if isinstance(start_date, str):
            start_date = datetime.date.fromisoformat(start_date)
        if isinstance(end_date, str):
            end_date = datetime.date.fromisoformat(end_date)
            
        # Check if manual
        is_manual = currency and start_date and end_date

        if is_manual:
            await self.log("INFO", f"Manual backfill triggered for {currency} ({start_date} to {end_date}) [Force: {force}]")
            await self.update_metadata({"mode": "manual", "currency": currency, "force": force})
        else:
            await self.log("INFO", "Auto-discovery backfill started.")
            await self.update_metadata({"mode": "auto"})

        async with SessionLocal() as db:
            if is_manual:
                # Manual Mode
                if not currency:
                     raise ValueError("Currency required for manual backfill")
                if currency == "USD":
                     await self.log("SUCCESS", "USD is the base currency (1.0). No backfill needed.")
                     await self.update_metadata({"result": "Success", "info": "Skipped USD (Base)"})
                     return

                currencies: List[str] = [currency]
                s_date = start_date
                e_date = end_date
            else:
                # Auto Mode
                # 1. Scan for requirements
                earliest_date = await self._find_earliest_purchase_date(db)
                if not earliest_date:
                    await self.log("INFO", "No assets with purchase dates found. Nothing to backfill.")
                    await self.update_metadata({"info": "No assets with purchase dates found."})
                    return

                currencies = await self._get_managed_currencies(db)
                if not currencies:
                    await self.log("INFO", "No managed currencies found.")
                    await self.update_metadata({"info": "No managed currencies found."})
                    return

                await self.log("INFO", f"Identified requirements: {currencies} from {earliest_date}")
                s_date = earliest_date
                e_date = datetime.date.today()

            # Retrieve retention settings (from agent config or defaults)
            # Priorities: agent_config passed in > self.config (if any) > defaults
            # Assuming agent_config is passed to execute or we use defaults.
            # But here execute(..., agent_config=...) 
            
            # Use defaults matching the UI screenshot if not present
            r_cfg = agent_config or {}
            ret_5m = int(r_cfg.get("retention_5min_days", 14))
            # Yahoo limit for 15m is 60 days. Set to 59 for safety.
            ret_15m = int(r_cfg.get("retention_15min_days", 59))
            ret_1h = int(r_cfg.get("retention_1h_days", 365))
            
            # Define Tiers: (Label, Interval, MaxAgeDays)
            # Order: High res (Youngest) -> Low res (Oldest)
            # 5m: 0 to 14 days
            # 15m: 14 to 180 days
            # 1h: 180 to 365 days
            # 1d: older than 365
            
            now_dt = datetime.datetime.utcnow().date()
            
            tiers = [
                ("5m", 0, ret_5m),
                ("15m", ret_5m, ret_15m),
                ("1h", ret_15m, ret_1h),
                ("1d", ret_1h, 36500) # Cap at ~100 years to prevent OverflowError 
            ]
            
            total_added = 0
            total_updated = 0
            total_skipped = 0
            
            await self.update_metadata({
                "stage": "Starting segmented backfill",
                "tiers": str(tiers)
            })

            # Process chunks
            # Start from Most Recent (High Res) backwards or just iterate tiers logic
            
            # Convert s_date, e_date to age in days from now
            # Actually better to work with Dates
            
            for interval_label, min_age_days, max_age_days in tiers:
                # Calculate tier window dates
                # Youngest date for this tier: Now - min_age
                # Oldest date for this tier: Now - max_age
                
                tier_start_limit = now_dt - datetime.timedelta(days=max_age_days)
                tier_end_limit = now_dt - datetime.timedelta(days=min_age_days)
                
                # Intersect with requested range [s_date, e_date]
                # Effective start = max(s_date, tier_start_limit)
                # Effective end = min(e_date, tier_end_limit)
                
                eff_start = max(s_date, tier_start_limit)
                eff_end = min(e_date, tier_end_limit)
                
                if eff_start >= eff_end:
                    # No overlap with this tier
                    continue
                
                await self.log("INFO", f"Fetching {interval_label} data for range {eff_start} to {eff_end}")
                
                 # ALWAYS fetch fresh data from API for backfill. 
                 # We rely on persistence layer to skip duplicates.
                source = "fresh"
                
                # Fetch
                try:
                    series = await self.market_data.get_historical_rates_series(
                        eff_start, eff_end, currencies, interval=interval_label, source=source
                    )
                except Exception as e:
                     await self.log("ERROR", f"Failed fetching {interval_label}: {e}")
                     continue

                if not series:
                    continue

                # Persist
                res = await self._persist_history(db, series, force=force)
                total_added += res["added"]
                total_updated += res["updated"]
                total_skipped += res["skipped"]

            # Report Cumulative Results
            summary = f"Backfill complete: +{total_added} records, updated {total_updated}, skipped {total_skipped}"
            await self.log("SUCCESS", summary)
            await self.update_metadata({
                "result": "Success",
                "added": total_added,
                "updated": total_updated,
                "skipped": total_skipped,
                "mode": "manual" if is_manual else "auto",
                "stage": "Completed"
            })

    async def _find_earliest_purchase_date(
        self, db: AsyncSession
    ) -> Optional[datetime.date]:
        # Find earliest purchase_date or transaction date
        # For now just Asset.purchase_date
        result = await db.execute(func.min(Asset.purchase_date))
        min_date: Optional[datetime.datetime] = result.scalar()

        if min_date:
            return min_date.date()

        # Default to 1 year ago if no assets? Or return None
        return None

    async def _get_managed_currencies(self, db: AsyncSession) -> List[str]:
        # Get all unique currencies from Users (merged)
        # In multi-user system this might be heavy, but for single user focus it's fine.
        result = await db.execute(select(User))
        users = result.scalars().all()

        all_currencies = set()
        for u in users:
            settings = u.settings or {}
            all_currencies.update(settings.get("currencies", []))
            all_currencies.update(settings.get("secondary_currencies", []))
            if settings.get("main_currency"):
                all_currencies.add(settings.get("main_currency"))

        # Also maybe distinct currencies from Assets?
        asset_result = await db.execute(select(Asset.currency).distinct())
        asset_currencies = asset_result.scalars().all()
        for c in asset_currencies:
            if c:
                all_currencies.add(c)

        if "USD" in all_currencies:
            all_currencies.remove(
                "USD"
            )  # Base is typically USD in DB, don't need to fetch USD-USD

        return list(all_currencies)

    async def _persist_history(
        self, db: AsyncSession, series: dict, force: bool = False
    ):
        # series: { "YYYY-MM-DD": { "EUR": 1.1, ... } }
        from app.services.market.persistence import MarketDataPersistence
        
        # 1. Flatten into list of records
        records = []
        for date_str, rates in series.items():
            dt = datetime.datetime.fromisoformat(date_str)
            for curr, rate in rates.items():
                if curr == "USD":
                    continue
                records.append({
                    "currency": curr,
                    "rate": rate,
                    "timestamp": dt
                })
        
        total_items = len(records)
        if total_items == 0:
            return {"added": 0, "updated": 0, "skipped": 0}
        
        # 2. Bulk Save (Upsert or Insert-if-New)
        # save_history_batch now returns int count of records written
        saved_count = await MarketDataPersistence.save_history_batch(records, upsert=force)
        
        # 3. Infer stats
        skipped = total_items - saved_count
        
        # "saved_count" could mean "added" (if not force) or "updated" (if force)
        # Technically it's "Saved".
        added = saved_count if not force else 0
        updated = saved_count if force else 0
        
        # If force=True, we replaced items, so effectively updated (or added if missing).
        # We can't distinguish easily without checking before, but this is sufficient for user feedback.
        
        results = {"added": added, "updated": updated, "skipped": skipped}
        return results
