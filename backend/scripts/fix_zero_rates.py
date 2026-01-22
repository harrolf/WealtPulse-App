import asyncio
import sys
import logging
from sqlalchemy import select

# Add parent directory to path to import app modules
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.database import SessionLocal  # noqa: E402
from app.models import ExchangeRateHistory  # noqa: E402

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

async def fix_zero_rates():
    async with SessionLocal() as db:
        # 1. Check CHF specifically
        logger.info("--- Diagnosing CHF Rates ---")
        stmt = (
            select(ExchangeRateHistory)
            .where(ExchangeRateHistory.currency == 'CHF')
            .order_by(ExchangeRateHistory.rate.asc())
            .limit(10)
        )
        result = await db.execute(stmt)
        chf_records = result.scalars().all()
        for r in chf_records:
            logger.info(f"CHF Record: ID={r.id}, Date={r.timestamp}, Rate={r.rate}")

        # 2. Check Global Zero/Null
        logger.info("--- Diagnosing Global Zero/Low Rates ---")
        # Check for NULL or effectively zero
        stmt = select(ExchangeRateHistory).where(
            (ExchangeRateHistory.rate.is_(None)) | (ExchangeRateHistory.rate < 0.0001)
        )
        result = await db.execute(stmt)
        bad_records = result.scalars().all()
        
        count = len(bad_records)
        logger.info(f"Found {count} records globally with rate < 0.0001 or NULL.")
        
        if count > 0:
            logger.info("Deleting these records...")
            for record in bad_records:
                 logger.info(f"Deleting: {record.currency} @ {record.timestamp} = {record.rate}")
                 await db.delete(record)
            
            await db.commit()
            logger.info("Deletion complete.")
        else:
            logger.info("No global bad records found.")

if __name__ == "__main__":
    asyncio.run(fix_zero_rates())
