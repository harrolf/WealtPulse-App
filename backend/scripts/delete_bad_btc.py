import asyncio

from app.database import SessionLocal
from app.models import ExchangeRateHistory
from sqlalchemy import delete


async def main():
    async with SessionLocal() as db:
        print("Deleting bad data point ID 33595...")
        # 33595 | 90513.1
        stmt = delete(ExchangeRateHistory).where(ExchangeRateHistory.id == 33595)
        result = await db.execute(stmt)
        await db.commit()
        print(f"Deleted {result.rowcount} row(s).")


if __name__ == "__main__":
    asyncio.run(main())
