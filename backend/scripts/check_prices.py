import asyncio
import os
import sys

# Add the parent directory to sys.path so we can import 'app'
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from app.database import SessionLocal  # noqa: E402
from app.models import PriceHistory  # noqa: E402
from sqlalchemy import select, func  # noqa: E402


async def check_price_history():
    async with SessionLocal() as session:
        result = await session.execute(select(func.count()).select_from(PriceHistory))
        count = result.scalar()
        print(f"PriceHistory Count: {count}")

        if count > 0:
            prices = await session.execute(select(PriceHistory).limit(5))
            for p in prices.scalars():
                print(f"AssetID: {p.asset_id}, Price: {p.price}, Date: {p.date}")


if __name__ == "__main__":
    asyncio.run(check_price_history())
