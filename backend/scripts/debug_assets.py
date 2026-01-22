import asyncio
from app.database import SessionLocal
from app.models import Asset, AssetType
from sqlalchemy import select


async def main():
    async with SessionLocal() as session:
        stmt = select(Asset, AssetType).join(
            AssetType, Asset.asset_type_id == AssetType.id
        )
        result = await session.execute(stmt)
        rows = result.all()
        print(f"Total Assets: {len(rows)}")
        for asset, asset_type in rows:
            print(
                f"ID: {asset.id}, Name: '{asset.name}', Ticker: {asset.ticker_symbol}, Quantity: {asset.quantity}, Currency: {asset.currency}, Type: {asset_type.name}"
            )


if __name__ == "__main__":
    asyncio.run(main())
