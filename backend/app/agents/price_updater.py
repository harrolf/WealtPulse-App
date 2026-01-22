import logging
from app.database import SessionLocal
from app.services.price_service import PriceService
from .base import BaseAgent

logger = logging.getLogger(__name__)

class PriceUpdaterAgent(BaseAgent):
    _instance = None
    name = "Asset Price Updater"
    description = "Updates current prices for all assets using market data providers."
    schedule_type = "interval"
    schedule_value = "3600" # 1 hour

    @classmethod
    def get_instance(cls):
        if cls._instance is None:
            cls._instance = cls()
        return cls._instance

    async def execute(self, **kwargs):
        async with SessionLocal() as db:
            await self.log("INFO", "Starting asset price update.")
            stats = await PriceService.update_asset_prices(db)
            await self.log("SUCCESS", f"Price update completed: {stats}")
            await self.update_metadata({
                "stats": stats,
                "status": "Success"
            })
