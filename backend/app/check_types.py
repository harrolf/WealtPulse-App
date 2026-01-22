
import asyncio
import os
import sys
from sqlalchemy import select

# Add the parent directory to sys.path
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from app.database import SessionLocal  # noqa: E402
from app.models import AssetType  # noqa: E402

async def list_asset_types():
    async with SessionLocal() as session:
        result = await session.execute(select(AssetType))
        types = result.scalars().all()
        print(f"{'ID':<5} {'Name':<30} {'Category':<15} {'User ID'}")
        print("-" * 60)
        for t in types:
            print(f"{t.id:<5} {t.name:<30} {t.category:<15} {t.user_id}")

if __name__ == "__main__":
    asyncio.run(list_asset_types())
