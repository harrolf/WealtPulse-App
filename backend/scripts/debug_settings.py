import asyncio
from app.database import SessionLocal
from app.models import User
from sqlalchemy import select


async def check_settings():
    async with SessionLocal() as db:
        result = await db.execute(select(User))
        users = result.scalars().all()
        for user in users:
            print(f"User ID: {user.id}")
            print(f"Email: {user.email}")
            print(f"Settings: {user.settings}")
            print("-" * 20)


if __name__ == "__main__":
    asyncio.run(check_settings())
