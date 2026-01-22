import asyncio
import os
import sys
import datetime
from sqlalchemy import select
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker

# Add parent dir to path to import app modules
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.core.config import settings  # noqa: E402
# from app.database import SessionLocal  # noqa: E402
from app.models import Asset, Transaction, PriceHistory  # noqa: E402


async def migrate_data():
    engine = create_async_engine(settings.DATABASE_URL)
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with async_session() as db:
        print("--- Starting Migration to Financial Reality Model ---")

        # 1. Fetch all Assets
        stmt = select(Asset)
        result = await db.execute(stmt)
        assets = result.scalars().all()

        updated_count = 0

        for asset in assets:
            # Check if asset has purchase data
            if not asset.purchase_date:
                continue

            p_date = asset.purchase_date
            if isinstance(p_date, datetime.datetime):
                p_date = p_date.date()

            p_price = asset.purchase_price

            # Find the "Initial" transaction
            # Logic: The earliest created transaction for this asset
            t_stmt = (
                select(Transaction)
                .where(Transaction.asset_id == asset.id)
                .order_by(Transaction.created_at.asc())
            )
            t_result = await db.execute(t_stmt)
            transactions = t_result.scalars().all()

            if not transactions:
                continue

            initial_tx = transactions[0]

            # Check if we need to migrate
            # If tx date is close to creation (2026) but purchase is old (e.g. < 2025)
            tx_date = initial_tx.date.date()

            # Threshold: If purchase date is more than 30 days before transaction date
            if (tx_date - p_date).days > 30:
                print(f"Migrating Asset: {asset.name} (ID: {asset.id})")
                print(f"  - Current Tx: {tx_date} @ {initial_tx.price_per_unit}")
                print(f"  - Reality:    {p_date} @ {p_price}")

                # UPDATE Transaction
                # Use purchase_price if available, otherwise keep existing (maybe it was entered correctly)
                new_price = (
                    p_price if p_price is not None else initial_tx.price_per_unit
                )

                # Construct new datetime for the transaction (Purchase Date at 00:00)
                new_dt = datetime.datetime.combine(p_date, datetime.datetime.min.time())

                initial_tx.date = new_dt
                initial_tx.price_per_unit = new_price
                initial_tx.notes = (
                    initial_tx.notes or ""
                ) + " [Migrated to Historical Date]"

                db.add(initial_tx)

                # UPDATE PriceHistory
                # We need to make sure we don't lose the "Current Value" info.
                # If we move the transaction back to 2010 @ 285k,
                # we need a PriceHistory point at 2010 @ 285k (Manual)
                # AND a PriceHistory point at 2026 @ 600k (Manual) - likely already exists?

                # Check for 2026 price history (Current/Manual)
                # The prompt implies the transaction price MIGHT have been the current value (600k).
                # If we overwrite it to 285k, we lose the 600k record if we don't save it.

                # Let's ensure a "Current" PriceHistory exists for the OLD transaction details
                # if the price is changing significantly.
                if (
                    abs((initial_tx.price_per_unit or 0) - (p_price or 0)) > 1.0
                    and p_price
                ):
                    # Calculate the "Current" date/price from the transaction before we change it
                    old_price = initial_tx.price_per_unit
                    old_date = initial_tx.date

                    # Check if a manual price exists near old_date
                    ph_stmt = select(PriceHistory).where(
                        PriceHistory.asset_id == asset.id,
                        PriceHistory.source == "Manual",
                        PriceHistory.date >= old_date - datetime.timedelta(days=1),
                        PriceHistory.date <= old_date + datetime.timedelta(days=1),
                    )
                    ph_exists = (await db.execute(ph_stmt)).scalar()

                    if not ph_exists:
                        print(
                            f"  + Preserving current value in PriceHistory: {old_price}"
                        )
                        new_ph = PriceHistory(
                            asset_id=asset.id,
                            date=old_date,
                            price=old_price,
                            currency=asset.currency,
                            source="Manual",
                        )
                        db.add(new_ph)

                # Ensure a "Historical" PriceHistory exists for the purchase
                ph_hist_stmt = select(PriceHistory).where(
                    PriceHistory.asset_id == asset.id,
                    PriceHistory.source == "Manual",
                    PriceHistory.date == new_dt,
                )
                ph_hist_exists = (await db.execute(ph_hist_stmt)).scalar()
                if not ph_hist_exists:
                    hist_ph = PriceHistory(
                        asset_id=asset.id,
                        date=new_dt,
                        price=new_price,
                        currency=asset.currency,
                        source="Manual",
                    )
                    db.add(hist_ph)

                updated_count += 1

        await db.commit()
        print(f"--- Migration Complete. Updated {updated_count} assets. ---")


if __name__ == "__main__":
    asyncio.run(migrate_data())
