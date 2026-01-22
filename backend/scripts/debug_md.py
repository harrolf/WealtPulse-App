
import asyncio
import os
import sys
from datetime import date

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from app.services.market.service import MarketDataService  # noqa: E402


async def main():
    try:
        md = MarketDataService()
        print("Market Data Service initialized")
        # Ensure lock is initialized if needed (it is in __init__)

        target = date(2025, 1, 1)
        print(f"Calling get_historical_rates for {target}")
        res = await md.get_historical_rates(target, ["EUR", "BTC"])
        print(f"Result: {res}")
    except Exception as e:
        print(f"ERROR: {e}")
        import traceback

        traceback.print_exc()


if __name__ == "__main__":
    asyncio.run(main())
