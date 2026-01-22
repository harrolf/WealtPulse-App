from decimal import Decimal
from typing import List, Dict, Tuple
import logging

from app.models import Asset
from app.math_utils import sanitize_decimal

logger = logging.getLogger(__name__)


class ValuationService:
    @staticmethod
    def get_price(
        asset: Asset,
        rates: Dict[str, Decimal],
        manual_prices: Dict[int, Tuple[Decimal, str]],
        main_currency: str = "USD",
    ) -> Decimal:
        """
        Calculate the unit price of an asset in the main currency.
        Priority:
        1. Manual Price (if available for the date context)
        2. Market Data (if ticker exists)
        3. Purchase Price (fallback)
        """
        price_in_usd = Decimal("0.0")

        # 1. Manual Price Override?
        if asset.id in manual_prices:
            price, currency = manual_prices[asset.id]
            # Convert to USD first (standardize) or directly to main?
            # Existing logic usually converted everything to USD then to Main.
            # Let's standardize to USD logic for consistency with MarketData service.

            rate_to_usd = ValuationService._get_rate_safe(rates, currency)
            price_in_usd = price * rate_to_usd

        # 2. Market Data?
        elif asset.ticker_symbol:
            # Ticker is usually X-USD or similar.
            # MarketDataService returns rates relative to USD.
            # E.g. "EUR": 1.08 means 1 EUR = 1.08 USD.
            # "AAPL": 150.0 means 1 AAPL = 150.0 USD.

            sym = asset.ticker_symbol

            # Identify effective ticker symbol in rates map
            # MarketDataService.resolve_ticker logic might have been applied before calling this
            # but getting the raw rate from the map:

            rate = ValuationService._get_rate_safe(rates, sym, default=None)

            if rate is not None:
                price_in_usd = rate
            else:
                # Fallback to purchase price
                pp = asset.purchase_price or Decimal("0.0")
                if isinstance(pp, float):
                    pp = sanitize_decimal(pp)
                curr = asset.currency or "USD"
                rate = ValuationService._get_rate_safe(rates, curr)
                price_in_usd = pp * rate

        # 3. Fallback: Purchase Price
        else:
            pp = asset.purchase_price or Decimal("0.0")
            if isinstance(pp, float):
                pp = sanitize_decimal(pp)
            curr = asset.currency or "USD"
            rate = ValuationService._get_rate_safe(rates, curr)
            price_in_usd = pp * rate

        # Convert USD -> Main Currency
        # Rate main_currency: X means 1 Main = X USD
        # So Price_Main = Price_USD / Rate_Main_USD

        main_rate_usd = ValuationService._get_rate_safe(rates, main_currency)

        if main_rate_usd == 0:
            return Decimal("0.0")

        return price_in_usd / main_rate_usd

    @staticmethod
    def calculate_portfolio_value(
        assets: List[Asset],
        quantities: Dict[int, Decimal],
        rates: Dict[str, Decimal],
        manual_prices: Dict[int, Tuple[Decimal, str]],
        main_currency: str = "USD",
    ) -> Tuple[Decimal, Dict[int, Decimal]]:
        """
        Calculate total portfolio value and individual asset values.
        Returns (total_value, {asset_id: value})
        """
        total_value = Decimal("0.0")
        asset_values = {}

        for asset in assets:
            qty = quantities.get(asset.id, Decimal("0.0"))
            if qty == 0:
                asset_values[asset.id] = Decimal("0.0")
                continue

            unit_price = ValuationService.get_price(
                asset, rates, manual_prices, main_currency
            )
            val = qty * unit_price

            asset_values[asset.id] = val
            total_value += val

        return total_value, asset_values

    @staticmethod
    def _get_rate_safe(
        rates: Dict[str, Decimal], symbol: str, default: Decimal = Decimal("1.0")
    ) -> Decimal:
        """Helper to lookup rates with common suffix fallbacks."""
        if not symbol:
            return default

        # Direct match
        if symbol in rates and rates[symbol] is not None:
            return rates[symbol]

        # Try stripping/modifying
        # MarketDataService usually handles this, but rates dict keys might vary

        # Common suffixes
        alternatives = [
            symbol,
            f"{symbol}=X",
            f"{symbol}-USD",
            symbol.replace("-USD", ""),
            symbol.replace("=X", ""),
        ]

        for alt in alternatives:
            if alt in rates and rates[alt] is not None:
                return rates[alt]

        return default
