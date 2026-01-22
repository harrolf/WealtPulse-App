import asyncio
import os
import sys

# Add the parent directory to sys.path so we can import 'app'
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from app.database import SessionLocal  # noqa: E402
from app.models import Asset, PriceHistory  # noqa: E402
# from app.services.market.service import MarketDataService  # noqa: E402
# from app.services.price_service import PriceService  # noqa: E402
from app.utils.datetime_utils import utc_now  # noqa: E402
from sqlalchemy import select  # noqa: E402


async def seed_mock_prices():
    async with SessionLocal() as session:
        # Find Trezor (BTC) and Nexo (BTC)
        result = await session.execute(
            select(Asset).where(Asset.name.ilike("%Trezor%"))
        )
        trezor = result.scalar_one_or_none()

        result = await session.execute(select(Asset).where(Asset.name.ilike("%Nexo%")))
        nexo = result.scalar_one_or_none()

        # Add price for BTC
        # Assuming purchase price was lower. Let's set a high current price.
        # Current BTC price is roughly $95k
        current_btc_price = 95000.0

        if trezor:
            print(f"Adding price for Trezor (Asset ID: {trezor.id})...")
            ph = PriceHistory(
                asset_id=trezor.id, price=current_btc_price, date=utc_now()
            )
            session.add(ph)

        if nexo:
            print(f"Adding price for Nexo (Asset ID: {nexo.id})...")
            ph = PriceHistory(asset_id=nexo.id, price=current_btc_price, date=utc_now())
            session.add(ph)

        await session.commit()
        print("Mock prices added.")


if __name__ == "__main__":
    asyncio.run(seed_mock_prices())
