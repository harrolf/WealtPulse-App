from .service import MarketDataService


def get_market_data() -> MarketDataService:
    return MarketDataService.get_instance()
