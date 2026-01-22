from typing import List
import logging
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from app import crud, schemas
from app.database import get_db
from ..deps import get_effective_user_id

logger = logging.getLogger(__name__)

router = APIRouter()


@router.get("", response_model=List[schemas.Asset])
async def read_assets(
    skip: int = 0,
    limit: int = 100,
    date: str = None,
    db: AsyncSession = Depends(get_db),
    user_id: int = Depends(get_effective_user_id),
):
    """
    Get all assets with pagination.
    If date is provided, returns the assets state (quantity, value) at that specific date.
    """
    from datetime import datetime
    from sqlalchemy import select
    from ...models import Transaction, Asset
    from ...services.market import get_market_data
    from ...math_utils import sanitize_float
    from decimal import Decimal

    # 1. Fetch current assets with pagination
    current_assets = await crud.get_assets(db, user_id=user_id, skip=skip, limit=limit)

    if not date:
        # Populate value_in_main_currency for normal view
        # from ...services.market import get_market_data
        from ...models import User

        # Get User Settings for Main Currency
        user_result = await db.execute(select(User).where(User.id == user_id))
        user_obj = user_result.scalars().first()
        settings = user_obj.settings or {}
        main_currency = settings.get("main_currency", "CHF")

        market_data = get_market_data()

        # Identify needed symbols
        symbols_needed = {main_currency}
        for asset in current_assets:
            if asset.ticker_symbol:
                symbols_needed.add(asset.ticker_symbol)
            elif asset.name in ["Bitcoin", "BTC"]:
                symbols_needed.add("BTC")
            elif asset.name in ["Ethereum", "ETH"]:
                symbols_needed.add("ETH")

            if asset.currency:
                symbols_needed.add(asset.currency)

        rates_raw = await market_data.get_rates(list(symbols_needed))
        rates = {
            k: Decimal(str(v)) if v is not None else Decimal(0)
            for k, v in rates_raw.items()
        }

        # Helper for rate
        def get_rate(sym, default=Decimal("1.0")):
            return (
                rates.get(sym, default)
                if rates.get(sym, default) != Decimal("0.0")
                else default
            )

        main_rate = get_rate(main_currency, Decimal("1.0"))

        # Enrich assets
        # Since current_assets are ORM objects, we can't easily attach new fields that aren't columns if we return them directly.
        # But we can convert aliases or return Pydantic models.
        # Actually, since response_model=List[schemas.Asset], FastAPI handles Pydantic conversion.
        # We can construct Pydantic objects or dicts.

        enriched_assets = []
        for asset in current_assets:
            # Calculate Value in USD (Base)
            price_usd = Decimal("0.0")
            ticker = asset.ticker_symbol
            if asset.name == "Bitcoin":
                ticker = "BTC"

            if ticker and ticker in rates:
                price_usd = rates[ticker]
            else:
                # Use current_price (from manual revaluation) if available, else purchase_price
                native_price = getattr(asset, "current_price", None)
                if native_price is None:
                    native_price = asset.purchase_price or Decimal("0.0")
                else:
                    native_price = Decimal(str(native_price))

                curr_rate = get_rate(asset.currency)
                price_usd = native_price * curr_rate

            qty = asset.quantity or Decimal(0)
            val_usd = qty * price_usd
            val_main = (
                sanitize_float(val_usd / main_rate) if main_rate != Decimal(0) else 0.0
            )

            # Create a dict from the ORM object (shallow copy of attrs)
            # Pydantic's from_attributes=True handles ORM objects, but we want to inject a field.
            # We can rely on Pydantic's `model_validate` or just pass a dict.
            # Since ORM objects might have lazy loaded fields, accessing them is safe if we fetched them?
            # crud.get_assets creates ORM objects.

            # Simple approach: let Pydantic validate the ORM object, then copy?
            # Or just set the attribute on the ORM object? Python objects are mutable.
            # But SQLAlchemy models might complain if the field doesn't exist.
            # Safer to return a list of dicts or Pydantic models.
            # Create DTO
            asset_dto = schemas.Asset.model_validate(asset)
            asset_dto.value_in_main_currency = val_main

            # Update current_price on the DTO so frontend uses live market data
            # price_usd is value of 1 unit in USD.
            # We want value of 1 unit in asset.currency.
            # asset.currency rate in USD is get_rate(asset.currency).
            curr_rate_val = get_rate(asset.currency, Decimal("1.0"))
            if curr_rate_val and curr_rate_val != Decimal("0.0"):
                asset_dto.current_price = sanitize_float(price_usd / curr_rate_val)
            else:
                asset_dto.current_price = sanitize_float(price_usd)

            enriched_assets.append(asset_dto)

        return enriched_assets

    # 2. Historical Mode
    try:
        target_date = datetime.strptime(date, "%Y-%m-%d").date()
    except ValueError:
        return current_assets  # Fallback

    from datetime import timezone

    # Calculate cutoff for transactions (end of target day)
    cutoff = datetime.combine(target_date, datetime.max.time()).replace(
        tzinfo=timezone.utc
    )

    # Fetch transactions occurred AFTER target_date
    stmt = (
        select(Transaction)
        .join(Asset)
        .where(Asset.user_id == user_id, Transaction.date > cutoff)
    )
    result = await db.execute(stmt)
    future_transactions = result.scalars().all()

    # Group changes by asset_id
    qty_adjustments = {}
    for t in future_transactions:
        qty_adjustments[t.asset_id] = qty_adjustments.get(t.asset_id, 0.0) + (
            t.quantity_change or 0.0
        )

    # Get Historical Prices
    market_data = get_market_data()

    # Identify needed symbols
    symbols_needed = set()
    for asset in current_assets:
        # Determine symbol
        if asset.ticker_symbol:
            symbols_needed.add(asset.ticker_symbol)
        elif asset.name in ["Bitcoin", "BTC"]:
            symbols_needed.add("BTC")
        elif asset.name in ["Ethereum", "ETH"]:
            symbols_needed.add("ETH")

        if asset.currency:
            symbols_needed.add(asset.currency)

    historical_rates = await market_data.get_historical_rates(
        target_date, list(symbols_needed)
    )

    # helper for rate
    def get_rate(sym, default=Decimal("1.0")):
        # Check direct match
        if sym in historical_rates:
            return historical_rates[sym]
        # Check normalized?
        return historical_rates.get(sym, default)

    # 3. Build Historical Asset DTOs
    historical_assets = []

    for asset in current_assets:
        # Adjust Quantity
        adjustment = qty_adjustments.get(asset.id, 0.0)
        hist_qty = asset.quantity - adjustment

        if hist_qty <= 0:
            continue  # Asset didn't exist or had 0 qty then

        # Adjust Price
        # Best effort: use ticker price if avail, else adjust purchase price by currency?
        # Actually asset.current_price in schema is usually USD value or unit price?
        # Schema says `current_price: Optional[float]`.

        hist_price = Decimal("0.0")
        ticker = asset.ticker_symbol
        if asset.name == "Bitcoin":
            ticker = "BTC"
        if asset.name == "Ethereum":
            ticker = "ETH"

        if ticker and ticker in historical_rates:
            hist_price = historical_rates[ticker]
        else:
            # Fallback: purchase_price * currency_rate
            # This assumes purchase_price is in native currency and constant
            native_price = asset.purchase_price or Decimal("0.0")
            curr_rate = historical_rates.get(asset.currency, Decimal("1.0"))
            hist_price = native_price * curr_rate  # Rough approximation in USD

        hist_price = sanitize_float(hist_price)

        # Create a copy/dict
        # We need to return schemas.Asset objects. Pydantic models are immutable-ish by default but we can construct new ones.
        # Actually `current_assets` are ORM models if crud returns them, or Pydantic models?
        # crud.get_assets likely returns ORM models.

        # We need to clone the ORM object or create a dict that matches the schema.
        # Let's assume we can set attributes on the Pydantic model response construction.
        # Since `response_model=List[schemas.Asset]`, FastAPI will convert dicts or objects.

        asset_dict = {
            "id": asset.id,
            "user_id": asset.user_id,
            "name": asset.name,
            "ticker_symbol": asset.ticker_symbol,
            "purchase_date": asset.purchase_date,
            "purchase_price": asset.purchase_price,
            "currency": asset.currency,
            "notes": asset.notes,
            "is_favorite": asset.is_favorite,
            "custom_fields": asset.custom_fields,
            "custodian_id": asset.custodian_id,
            "asset_type_id": asset.asset_type_id,
            "group_id": asset.group_id,
            "created_at": asset.created_at,
            "updated_at": asset.updated_at,
            # Computed
            "quantity": hist_qty,
            "current_price": hist_price,
            # Relationships (Pydantic will serialize models)
            "asset_type": asset.asset_type,
            "custodian": asset.custodian,
        }
        historical_assets.append(asset_dict)

    return historical_assets


@router.post("", response_model=schemas.Asset)
async def create_asset(
    asset: schemas.AssetCreate,
    db: AsyncSession = Depends(get_db),
    user_id: int = Depends(get_effective_user_id),
):
    return await crud.create_asset(db=db, asset=asset, user_id=user_id)


@router.get("/value-history/{history_id}", response_model=schemas.PriceHistory)
async def get_value_history_item(
    history_id: int,
    db: AsyncSession = Depends(get_db),
    user_id: int = Depends(get_effective_user_id),
):
    """
    Get a specific manual valuation entry.
    """
    from ...models import Asset, PriceHistory
    from sqlalchemy import select

    stmt = (
        select(PriceHistory)
        .join(Asset, PriceHistory.asset_id == Asset.id)
        .where(PriceHistory.id == history_id, Asset.user_id == user_id)
    )
    result = await db.execute(stmt)
    entry = result.scalars().first()

    if not entry:
        raise HTTPException(status_code=404, detail="Valuation entry not found")
    return entry


@router.put("/value-history/{history_id}", response_model=schemas.PriceHistory)
async def update_value_history(
    history_id: int,
    history_in: schemas.PriceHistoryUpdate,
    db: AsyncSession = Depends(get_db),
    user_id: int = Depends(get_effective_user_id),
):
    """
    Update a specific manual valuation entry.
    """
    from ...models import Asset, PriceHistory
    from sqlalchemy import select

    # Fetch history entry joined with Asset to verify user ownership
    stmt = (
        select(PriceHistory)
        .join(Asset, PriceHistory.asset_id == Asset.id)
        .where(PriceHistory.id == history_id, Asset.user_id == user_id)
    )
    result = await db.execute(stmt)
    history_entry = result.scalars().first()

    # Update fields
    if history_in.date:
        history_entry.date = history_in.date
    if history_in.price is not None:
        history_entry.price = history_in.price
    if history_in.currency:
        history_entry.currency = history_in.currency
    if history_in.source:
        history_entry.source = history_in.source

    await db.commit()
    await db.refresh(history_entry)
    return history_entry


@router.delete("/value-history/{history_id}")
async def delete_value_history(
    history_id: int,
    db: AsyncSession = Depends(get_db),
    user_id: int = Depends(get_effective_user_id),
):
    """
    Delete a specific manual valuation entry.
    """
    from ...models import Asset, PriceHistory
    from sqlalchemy import select

    # Verify ownership
    stmt = (
        select(PriceHistory)
        .join(Asset, PriceHistory.asset_id == Asset.id)
        .where(PriceHistory.id == history_id, Asset.user_id == user_id)
    )
    result = await db.execute(stmt)
    history_entry = result.scalars().first()

    if not history_entry:
        raise HTTPException(
            status_code=404, detail="Valuation entry not found or access denied"
        )

    await db.delete(history_entry)
    await db.commit()

    return {"message": "Valuation deleted successfully"}


@router.get("/{asset_id}", response_model=schemas.Asset)
async def read_asset(
    asset_id: int,
    db: AsyncSession = Depends(get_db),
    user_id: int = Depends(get_effective_user_id),
):
    asset = await crud.get_asset(db, asset_id=asset_id, user_id=user_id)
    if asset is None:
        raise HTTPException(status_code=404, detail="Asset not found")
    return asset


@router.put("/{asset_id}", response_model=schemas.Asset)
async def update_asset(
    asset_id: int,
    asset_update: schemas.AssetUpdate,
    db: AsyncSession = Depends(get_db),
    user_id: int = Depends(get_effective_user_id),
):
    asset = await crud.update_asset(
        db, asset_id=asset_id, asset_update=asset_update, user_id=user_id
    )
    if asset is None:
        raise HTTPException(status_code=404, detail="Asset not found")
    return asset


@router.delete("/{asset_id}")
async def delete_asset(
    asset_id: int,
    db: AsyncSession = Depends(get_db),
    user_id: int = Depends(get_effective_user_id),
):
    success = await crud.delete_asset(db, asset_id=asset_id, user_id=user_id)
    if not success:
        raise HTTPException(status_code=404, detail="Asset not found")
    return {"status": "success"}


@router.post("/{id}/revalue", response_model=schemas.PriceHistory)
async def revalue_asset(
    id: int,
    history_in: schemas.PriceHistoryCreate,
    db: AsyncSession = Depends(get_db),
    user_id: int = Depends(get_effective_user_id),
):
    """
    Manually revalue an asset at a specific date.
    Creates a PriceHistory entry with source="Manual".
    """
    from ...models import Asset, PriceHistory
    from sqlalchemy import select

    # print(f"DEBUG: Revaluing asset {id} for user {user_id}") # Removed debug print

    # Verify asset ownership
    result = await db.execute(
        select(Asset).where(Asset.id == id, Asset.user_id == user_id)
    )
    asset = result.scalars().first()
    if not asset:
        logger.warning(f"Asset not found for revalue (ID: {id}, User: {user_id})")
        raise HTTPException(status_code=404, detail="Asset not found")
    # Check if manual entry exists for this date
    stmt = select(PriceHistory).where(
        PriceHistory.asset_id == id,
        PriceHistory.date == history_in.date,
        PriceHistory.source == "Manual",
    )
    existing_result = await db.execute(stmt)
    existing = existing_result.scalars().first()

    if existing:
        existing.price = history_in.price
        existing.currency = history_in.currency
        await db.commit()
        await db.refresh(existing)
        return existing
    else:
        new_history = PriceHistory(
            asset_id=id,
            date=history_in.date,
            price=history_in.price,
            currency=history_in.currency,
            source="Manual",
        )
        db.add(new_history)
        await db.commit()
        await db.refresh(new_history)
        return new_history


@router.get("/{id}/value-history", response_model=List[schemas.PriceHistory])
async def get_asset_value_history(
    id: int,
    db: AsyncSession = Depends(get_db),
    user_id: int = Depends(get_effective_user_id),
):
    """
    Get manual value history for an asset.
    """
    from ...models import Asset, PriceHistory
    from sqlalchemy import select

    # Verify asset ownership
    result = await db.execute(
        select(Asset).where(Asset.id == id, Asset.user_id == user_id)
    )
    asset = result.scalars().first()
    if not asset:
        logger.warning(f"Asset not found for value history (ID: {id}, User: {user_id})")
        raise HTTPException(status_code=404, detail="Asset not found")

    stmt = (
        select(PriceHistory)
        .where(PriceHistory.asset_id == id, PriceHistory.source == "Manual")
        .order_by(PriceHistory.date.desc())
    )

    result = await db.execute(stmt)
    return result.scalars().all()
