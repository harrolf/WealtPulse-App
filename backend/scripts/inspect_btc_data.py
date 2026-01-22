import asyncio

from app.database import SessionLocal
from app.models import ExchangeRateHistory
from sqlalchemy import select


async def main():
    async with SessionLocal() as db:
        print("Inspecting BTC data for 2026-01-16 and surrounding days...")

        stmt = (
            select(ExchangeRateHistory)
            .where(
                ExchangeRateHistory.currency == "BTC",
                ExchangeRateHistory.timestamp >= "2026-01-10",
            )
            .order_by(ExchangeRateHistory.timestamp)
        )

        result = await db.execute(stmt)
        rows = result.scalars().all()

        for row in rows:
            print(f"Date: {row.timestamp} | Rate: {row.rate} | ID: {row.id}")


if __name__ == "__main__":
    asyncio.run(main())
