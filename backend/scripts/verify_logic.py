import asyncio
import os
import sys

# Add the parent directory to sys.path so we can import 'app'
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from app.database import SessionLocal  # noqa: E402
from app import crud  # noqa: E402


async def verify_get_assets():
    async with SessionLocal() as session:
        assets = await crud.get_assets(session, user_id=1)

        btc_asset = next((a for a in assets if "Trezor" in a.name), None)
        if btc_asset:
            print(f"Asset: {btc_asset.name}")
            print(f"Current Price: {btc_asset.current_price}")
            print(f"Purchase Price: {btc_asset.purchase_price}")
        else:
            print("Trezor asset not found")


if __name__ == "__main__":
    asyncio.run(verify_get_assets())
