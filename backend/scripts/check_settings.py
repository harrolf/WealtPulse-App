import asyncio
import os
import sys

# Add current directory to path
sys.path.append(os.getcwd())

from app.database import SessionLocal  # noqa: E402
from app.models import User  # noqa: E402
from sqlalchemy import select  # noqa: E402


async def main():
    async with SessionLocal() as db:
        result = await db.execute(select(User))
        users = result.scalars().all()
        for u in users:
            print(f"User: {u.email} (ID: {u.id})")
            print(f"Settings: {u.settings}")
            print("-" * 20)


if __name__ == "__main__":
    asyncio.run(main())
