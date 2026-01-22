import asyncio
import os
import sys
from sqlalchemy import update, delete
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker

# Add parent dir to path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.core.config import settings  # noqa: E402
from app.models import Asset, PriceHistory  # noqa: E402


async def main():
    engine = create_async_engine(settings.DATABASE_URL)
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with async_session() as db:
        print("--- Fixing Crypto Assets ---")

        # 1. Fix BTC Tickers (Assets 6 and 7)
        # Change Ticker to 'BTC-USD' to match Yahoo Finance correctly and avoid ambiguity
        print("Updating Tickers for Asset 6 (Trezor), 7 (Nexo BTC) to 'BTC-USD'...")
        await db.execute(
            update(Asset).where(Asset.id.in_([6, 7])).values(ticker_symbol="BTC-USD")
        )

        # 2. Delete Stale Manual PriceHistory for BTC
        # This removes the "Purchase Price ($1000)" override that was causing the low valuation.
        # The system will now fall back to the Ticker (which we just fixed).
        print("Deleting Manual PriceHistory for Asset 6, 7...")
        await db.execute(
            delete(PriceHistory).where(
                PriceHistory.asset_id.in_([6, 7]), PriceHistory.source == "Manual"
            )
        )

        # 3. Fix Asset 33 (Nexo USD Cash)
        # Identified as likely USD Cash with incorrect 2.0 price.
        # Screenshot showed ~97k CHF value for 61k units, implying ~1.6 USD valuation?
        # If it's cash, price should be 1.0.
        # We also clear ticker to prevent accidental lookups and clear Manual history to enforce P.Price.
        print("Fixing Asset 33 (Nexo USD) Cost Basis to 1.0...")
        await db.execute(
            update(Asset)
            .where(Asset.id == 33)
            .values(purchase_price=1.0, ticker_symbol=None)
        )
        await db.execute(
            delete(PriceHistory).where(
                PriceHistory.asset_id == 33, PriceHistory.source == "Manual"
            )
        )

        await db.commit()
        print("--- Done. Please refresh dashboard to fetch live prices. ---")


if __name__ == "__main__":
    asyncio.run(main())
