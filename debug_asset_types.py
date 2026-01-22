
import asyncio
import os
import sys

# Add path to import app modules
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)) + "/backend")

from app.database import SessionLocal
from app.models import AssetType, Asset
from sqlalchemy import select, func

async def inspect():
    async with SessionLocal() as session:
        print("--- Existing Asset Types ---")
        result = await session.execute(select(AssetType))
        types = result.scalars().all()
        for t in types:
            print(f"ID: {t.id} | Name: {t.name} | Category: {t.category}")

        print("\n--- Assets by Type ---")
        # Count assets per type
        stmt = select(AssetType.name, func.count(Asset.id)).join(Asset, Asset.asset_type_id == AssetType.id).group_by(AssetType.name)
        result = await session.execute(stmt)
        for name, count in result:
            print(f"Type: {name} | Count: {count}")

        # Check for assets with unknown types? (Should be caught by FK, but good to verify if logical deletion happened)
        
        # Check specifically for "Investment"
        stmt = select(AssetType).where(AssetType.name == "Investment")
        result = await session.execute(stmt)
        inv = result.scalar_one_or_none()
        if inv:
            print(f"\nFOUND 'Investment' AssetType! ID: {inv.id}")
        print("\n--- Searching for 'Invest - Harrolf' ---")
        stmt = select(Asset).where(Asset.name.ilike("%Invest - Harrolf%"))
        result = await session.execute(stmt)
        assets = result.scalars().all()
        
        if assets:
            for asset in assets:
                print(f"Asset ID: {asset.id} | Name: {asset.name}")
                print(f"  Asset Type ID: {asset.asset_type_id}")
                
                # Fetch type
                stmt_type = select(AssetType).where(AssetType.id == asset.asset_type_id)
                res_type = await session.execute(stmt_type)
                atype = res_type.scalar_one_or_none()
                if atype:
                    print(f"  Asset Type Name: {atype.name}")
                    print(f"  Category: {atype.category}")
                    print(f"  Fields: {atype.fields}")
                else:
                    print(f"  Asset Type NOT FOUND (ID: {asset.asset_type_id})")
        else:
            print("Asset 'Invest - Harrolf' not found.")

if __name__ == "__main__":
    asyncio.run(inspect())
