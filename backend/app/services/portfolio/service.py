import logging
import datetime
from typing import Dict, List, Optional, Any
from decimal import Decimal

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, desc
from sqlalchemy.orm import selectinload

from app.models import Asset, Transaction, PriceHistory, User
from app.services.market import get_market_data
from app.utils.datetime_utils import utc_now
from app.math_utils import sanitize_decimal

from .valuation import ValuationService

logger = logging.getLogger(__name__)


class PortfolioService:
    @staticmethod
    async def get_summary(
        db: AsyncSession, user_id: int, target_date: Optional[datetime.date] = None
    ) -> Dict[str, Any]:
        """
        Get portfolio summary: Total Value, list of Asset values.
        Orchestrates loading assets, fetching rates, and valuation.
        """
        # 1. Load Assets (Eager load needed relations)
        # Note: If target_date is set, we technically need ASSETS THAT EXISTED THEN.
        # But commonly we load all and check quantity at date.

        # Load User Settings
        user = await db.get(User, user_id)
        if not user:
            return {}
        settings = user.settings or {}
        main_currency = settings.get("main_currency", "USD")

        stmt = (
            select(Asset)
            .where(Asset.user_id == user_id)
            .options(
                selectinload(Asset.asset_type),
                selectinload(Asset.custodian),
                selectinload(Asset.group),
                selectinload(Asset.tags),
            )
        )
        assets = (await db.execute(stmt)).scalars().all()

        if not assets:
            return {
                "total_net_worth": Decimal("0.0"),
                "currency": main_currency,
                "asset_count": 0,
                "assets": [],
            }

        # 2. Determine Quantities
        quantities = {}
        if target_date:
            # Need historical quantities
            # This logic (replaying transactions) was in calculate_historical_quantities
            # For brevity in this refactor, let's assuming current quantity for now or implement replay.
            # To do it right:
            quantities = await PortfolioService._calculate_historical_quantities(
                db, assets, target_date
            )
        else:
            quantities = {a.id: sanitize_decimal(a.quantity) for a in assets}

        # 3. Market Data Context
        # 3. Market Data Context
        # Collect currencies needed
        currencies = set([main_currency])
        for a in assets:
            if a.currency:
                currencies.add(a.currency)
            if a.ticker_symbol:
                currencies.add(a.ticker_symbol)

        # Add secondary currencies from settings
        secondary_currencies = settings.get("secondary_currencies", [])
        for sc in secondary_currencies:
            currencies.add(sc)

        md = get_market_data()
        if target_date:
            rates = await md.get_historical_rates(target_date, list(currencies))
        else:
            rates = await md.get_rates(list(currencies))

        # 4. Manual Prices Context
        manual_prices = {}
        # Fetch latest manual price for each asset <= target_date (or now)
        # This optimization is crucial.
        date_limit = target_date or utc_now().date()

        # Optimization: Window function to get latest per asset
        subq = (
            select(
                PriceHistory.asset_id,
                PriceHistory.price,
                PriceHistory.currency,
                PriceHistory.date,
                func.row_number()
                .over(
                    partition_by=PriceHistory.asset_id, order_by=desc(PriceHistory.date)
                )
                .label("rn"),
            )
            .where(
                PriceHistory.asset_id.in_([a.id for a in assets]),
                PriceHistory.date <= date_limit,
            )
            .subquery()
        )
        stmt_mp = select(subq.c.asset_id, subq.c.price, subq.c.currency).where(
            subq.c.rn == 1
        )
        mp_result = await db.execute(stmt_mp)

        for row in mp_result:
            manual_prices[row.asset_id] = (sanitize_decimal(row.price), row.currency)

        # 5. Valuation
        total_val, asset_vals_map = ValuationService.calculate_portfolio_value(
            assets, quantities, rates, manual_prices, main_currency
        )

        # Calculate secondary currency totals
        # Formula: Total(Target) = Total(Main) * Rate(Main->USD) / Rate(Target->USD)
        # But rates are X->USD.
        # So 1 Main = Rate(Main) USD.
        # 1 Target = Rate(Target) USD.
        # Main->Target = Rate(Main) / Rate(Target).
        # Total(Target) = Total(Main) * (Rate(Main) / Rate(Target))

        currencies_values = {main_currency: float(round(total_val, 2))}

        # Helper to get rate safely
        def get_rate_val(sym):
            r = rates.get(sym)
            if r is None:
                return Decimal("0.0")
            return Decimal(str(r))

        rate_main = get_rate_val(main_currency)

        for sc in secondary_currencies:
            if sc == main_currency:
                continue
            rate_sc = get_rate_val(sc)
            if rate_sc > 0 and rate_main > 0:
                # Convert
                val_sc = total_val * (rate_main / rate_sc)
                currencies_values[sc] = float(round(val_sc, 2))
            else:
                currencies_values[sc] = 0.0

        # 6. Format Response
        asset_list = []
        for asset in assets:
            val = asset_vals_map.get(asset.id, Decimal("0.0"))
            qty = quantities.get(asset.id, Decimal("0.0"))

            # Skip zero assets? Depends on view. Usually yes if qty=0 and val=0.
            if qty == 0 and val == 0:
                continue

            asset_list.append(
                {
                    "id": asset.id,
                    "name": asset.name,
                    "asset_type": asset.asset_type.name if asset.asset_type else "Unknown",
                    "category": asset.asset_type.category
                    if asset.asset_type
                    else "Unknown",
                    "quantity": float(qty),
                    "value": float(round(val, 2)),
                    "currency": main_currency,
                    "asset_currency": asset.currency,
                    "custodian": asset.custodian.name if asset.custodian else "Unknown",
                    "primary_group": asset.group.name if asset.group else "None",
                    "tags": [t.name for t in asset.tags],
                }
            )

        return {
            "total_value": float(round(total_val, 2)),
            "main_currency": main_currency,
            "total_assets": len(asset_list),
            "assets": asset_list,
            "currencies": currencies_values,
            "is_historical": target_date is not None,
            "date": target_date.isoformat()
            if target_date
            else utc_now().date().isoformat(),
        }

    @staticmethod
    async def _calculate_historical_quantities(
        db: AsyncSession, assets: List[Asset], target_date: datetime.date
    ) -> Dict[int, Decimal]:
        """
        Reconstruct asset quantities for a past date.
        Formula: Qty(Target) = Qty(Now) - Sum(NetFlows between Target and Now)
        Wait. If Now > Target.
        Transactions between Target and Now:
        Buy +10. Now we have 100. So at Target we had 90.
        So: Qty(Target) = Qty(Now) - (Buys) + (Sells)
        """
        quantities = {a.id: sanitize_decimal(a.quantity) for a in assets}
        asset_ids = [a.id for a in assets]
        if not asset_ids:
            return quantities

        # Fetch transactions after target_date
        stmt = select(Transaction).where(
            Transaction.asset_id.in_(asset_ids), Transaction.date > target_date
        )
        txs = (await db.execute(stmt)).scalars().all()

        for tx in txs:
            # Reverse the effect
            q = sanitize_decimal(tx.quantity_change)
            if tx.type == "BUY":
                quantities[tx.asset_id] -= q
            elif tx.type == "SELL":
                quantities[tx.asset_id] += q

        return quantities

    @staticmethod
    async def get_performance(
        db: AsyncSession,
        user_id: int,
        start_date: datetime.date,
        end_date: datetime.date = None,
    ) -> Dict[str, Any]:
        """
        Calculate performance between start_date and end_date.
        Performance = (EndValue - StartValue) / StartValue
        """
        if not end_date:
            end_date = utc_now().date()

        # 1. Get Values
        start_summary = await PortfolioService.get_summary(db, user_id, start_date)
        end_summary = await PortfolioService.get_summary(db, user_id, end_date)

        start_val = start_summary.get("total_value", 0.0)
        end_val = end_summary.get("total_value", 0.0)

        # 2. Calculate Percentage
        perf_pct = 0.0
        if start_val > 1.0:
            perf_pct = ((end_val - start_val) / start_val) * 100.0
        elif end_val > 1.0:  # Started from zero
            perf_pct = 100.0

        return {
            "performance_percent": round(perf_pct, 2),
            "end_value": round(end_val, 2),
            "start_value": round(start_val, 2),
            "change_value": round(end_val - start_val, 2),
            "start_date": start_date.isoformat(),
            "end_date": end_date.isoformat(),
            "currency": start_summary.get("main_currency", "USD"),
        }

    @staticmethod
    async def get_history(
        db: AsyncSession,
        user_id: int,
        time_range: str = "30d",
        custom_start: Optional[datetime.date] = None,
        custom_end: Optional[datetime.date] = None,
    ) -> List[Dict[str, Any]]:
        """
        Get portfolio value history series (Optimized Batch Mode).
        """
        # 1. Determine Range
        end_date = custom_end or utc_now().date()

        if custom_start:
            start_date = custom_start
        else:
            start_date = end_date - datetime.timedelta(days=30)
            if time_range == "1w":
                start_date = end_date - datetime.timedelta(days=7)
            elif time_range == "3m":
                start_date = end_date - datetime.timedelta(days=90)
            elif time_range == "1y":
                start_date = end_date - datetime.timedelta(days=365)
            elif time_range == "all":
                start_date = end_date - datetime.timedelta(days=365 * 5)

        days = (end_date - start_date).days
        step = 1
        if days > 90:
            step = 7

        dates = []
        curr = start_date
        while curr <= end_date:
            dates.append(curr)
            curr += datetime.timedelta(days=step)

        # 2. Fetch Shared Context
        user = await db.get(User, user_id)
        if not user:
            return []
        settings = user.settings or {}
        main_currency = settings.get("main_currency", "USD")

        # Load all assets (no need for eager loading group/tags for historical value)
        stmt = (
            select(Asset)
            .where(Asset.user_id == user_id)
            .options(selectinload(Asset.asset_type))
        )
        assets = (await db.execute(stmt)).scalars().all()
        if not assets:
            return []
        asset_ids = [a.id for a in assets]

        # 3. Batch Market Data
        currencies = set([main_currency])
        for a in assets:
            if a.currency:
                currencies.add(a.currency)
            if a.ticker_symbol:
                currencies.add(a.ticker_symbol)

        md = get_market_data()
        range_rates = await md.get_historical_rates_range(dates, list(currencies))

        # 4. Batch Manual Prices
        mp_stmt = (
            select(PriceHistory)
            .where(PriceHistory.asset_id.in_(asset_ids), PriceHistory.date <= end_date)
            .order_by(PriceHistory.date.asc())
        )
        all_mp = (await db.execute(mp_stmt)).scalars().all()
        asset_mp_history = {aid: [] for aid in asset_ids}
        for mp in all_mp:
            asset_mp_history[mp.asset_id].append(mp)

        # 5. Batch Quantities Replay (Backward)
        tx_stmt = (
            select(Transaction)
            .where(Transaction.asset_id.in_(asset_ids), Transaction.date > start_date)
            .order_by(Transaction.date.desc())
        )
        all_txs = (await db.execute(tx_stmt)).scalars().all()

        current_quantities = {a.id: sanitize_decimal(a.quantity) for a in assets}
        dates_desc = sorted(dates, reverse=True)
        tx_ptr = 0
        daily_quantities = {}

        temp_qty = current_quantities.copy()
        for d in dates_desc:
            while tx_ptr < len(all_txs) and all_txs[tx_ptr].date.date() > d:
                tx = all_txs[tx_ptr]
                q = sanitize_decimal(tx.quantity_change)
                # Revert: If it was a buy (>0), subtract. If sell (<0), add back.
                # Transaction model uses quantity_change which is positive for BUY and SELL (logic in crud.py)
                # Wait, crud.py usually handles signs or has a type.
                # models.py says Transaction has type Buy, Sell, etc.
                if tx.type == "BUY":
                    temp_qty[tx.asset_id] -= q
                elif tx.type == "SELL":
                    temp_qty[tx.asset_id] += q
                tx_ptr += 1
            daily_quantities[d.isoformat()] = temp_qty.copy()

        # 6. Calculate History
        history = []
        for d in dates:
            d_str = d.isoformat()
            dt_rates = range_rates.get(d_str, {"USD": Decimal("1.0")})
            dt_quantities = daily_quantities.get(d_str, {})

            dt_manual_prices = {}
            for aid in asset_ids:
                mps = asset_mp_history[aid]
                latest = None
                for mp in mps:
                    if mp.date.date() <= d:
                        latest = mp
                    else:
                        break
                if latest:
                    dt_manual_prices[aid] = (
                        sanitize_decimal(latest.price),
                        latest.currency,
                    )

            total_val, _ = ValuationService.calculate_portfolio_value(
                assets, dt_quantities, dt_rates, dt_manual_prices, main_currency
            )

            history.append({"date": d_str, "value": float(round(total_val, 2))})

        return history

    @staticmethod
    async def get_performance_detail(
        db: AsyncSession, user_id: int, time_range: str = "1y"
    ) -> Dict[str, Any]:
        """
        Get detailed TWR performance series + Annualized metrics.
        """
        # This mirrors get_history regarding dates, but calculates return vs start
        history = await PortfolioService.get_history(db, user_id, time_range)

        # Calculate TWR series (mock validation for now: just normal growth vs first point)
        if not history:
            return {
                "twr_series": [],
                "mwr_annualized": 0.0,
                "net_invested": 0.0,
                "start_value": 0.0,
                "end_value": 0.0,
            }

        start_val = history[0]["value"]
        twr_series = []

        for point in history:
            val = point["value"]
            pct = 0.0
            if start_val > 0:
                pct = ((val - start_val) / start_val) * 100.0
            elif val > 0:
                pct = 100.0

            twr_series.append(
                {
                    "date": point["date"],
                    "value": pct,
                    # Frontend might expect these extras per point:
                    "portfolio_value": val,
                    "daily_return": 0.0,
                    "net_invested_cumulative": 0.0,
                }
            )

        return {
            "twr_series": twr_series,
            "mwr_annualized": 0.0,  # TODO: Implement real XIRR
            "net_invested": 0.0,  # TODO: Implement real Net Invested from FlowService
            "start_value": float(start_val),
            "end_value": float(history[-1]["value"] if history else 0.0),
        }

    @staticmethod
    async def get_performance_summary(
        db: AsyncSession,
        user_id: int,
        start_date: Optional[datetime.date] = None,
        end_date: Optional[datetime.date] = None,
    ) -> Dict[str, Any]:
        """
        Get performance summary stats (start, end, change, breakdown).
        """
        # Get history for the range
        history = await PortfolioService.get_history(
            db, user_id, custom_start=start_date, custom_end=end_date
        )

        if not history:
            return {
                "start_value": 0,
                "end_value": 0,
                "change_value": 0,
                "performance_percent": 0,
                "breakdown": [],
            }

        start_val = history[0]["value"]
        end_val = history[-1]["value"]
        change = end_val - start_val
        pct = 0.0
        if start_val > 0:
            pct = (change / start_val) * 100.0
        elif end_val > 0:
            pct = 100.0

        current_alloc = await PortfolioService.get_allocation(db, user_id)
        breakdown = current_alloc.get("by_asset_type", [])

        return {
            "period": f"{start_date} to {end_date}" if start_date else "All Time",
            "start_value": start_val,
            "end_value": end_val,
            "change_value": change,
            "performance_percent": pct,
            "breakdown": [
                {
                    "name": item["name"],
                    "value": item["value"],
                    "change_value": 0.0,  # Placeholder
                    "performance_percent": pct, # Using overall pct for now
                }
                for item in breakdown
            ],
        }

    @staticmethod
    async def get_allocation(db: AsyncSession, user_id: int) -> Dict[str, Any]:
        """
        Get portfolio allocation breakdown.
        """
        summary = await PortfolioService.get_summary(db, user_id)
        assets = summary.get("assets", [])
        total_val = summary.get("total_value", 0)

        def group_by(key_func):
            groups = {}
            for a in assets:
                k = key_func(a)
                if not k:
                    k = "Other"
                val = a.get("value", 0)
                if k not in groups:
                    groups[k] = 0
                groups[k] += val
            result = []
            for k, v in groups.items():
                result.append({"name": k, "value": float(round(v, 2))})
            return result

        return {
            "by_asset_type": group_by(lambda a: a.get("type")),
            "by_category": group_by(lambda a: a.get("category")),
            "by_currency": group_by(lambda a: a.get("asset_currency")),
            "by_custodian": group_by(lambda a: a.get("custodian")),
            "by_group": group_by(lambda a: a.get("primary_group")),
            "by_tag": PortfolioService._group_assets_by_tag(assets),
            "total": total_val,
        }

    @staticmethod
    def _group_assets_by_tag(assets: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Helper to group asset values by tags (multi-grouping possible)."""
        tag_groups = {}
        for a in assets:
            tags = a.get("tags", [])
            val = a.get("value", 0)
            if not tags:
                tag_groups["No Tag"] = tag_groups.get("No Tag", 0) + val
            else:
                for t in tags:
                    tag_groups[t] = tag_groups.get(t, 0) + val

        return [{"name": k, "value": float(round(v, 2))} for k, v in tag_groups.items()]
