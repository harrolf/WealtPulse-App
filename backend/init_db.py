import asyncio
from app.database import engine, Base
# Import all models to ensure they are registered
from app.models import (
    User, Asset, AssetType, AssetTypeCategory, 
    Custodian, PrimaryGroup, Tag, Transaction, 
    PriceHistory, MarketDataHistory, SystemLog
)

# Ensure models are registered
_ = [
    User, Asset, AssetType, AssetTypeCategory, 
    Custodian, PrimaryGroup, Tag, Transaction, 
    PriceHistory, MarketDataHistory, SystemLog
]

async def init_db():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    print("Tables created successfully.")

if __name__ == "__main__":
    asyncio.run(init_db())
