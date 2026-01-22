from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update, desc
from sqlalchemy.orm import joinedload, selectinload
from typing import List, Optional

from . import models, schemas
from .utils.datetime_utils import utc_now


# Custodians
async def get_custodians(
    db: AsyncSession, user_id: int, skip: int = 0, limit: int = 100
) -> List[models.Custodian]:
    result = await db.execute(
        select(models.Custodian)
        .where(models.Custodian.user_id == user_id)
        .offset(skip)
        .limit(min(limit, 1000))
    )
    return result.scalars().all()


async def create_custodian(
    db: AsyncSession, custodian: schemas.CustodianCreate, user_id: int, commit: bool = True
) -> models.Custodian:
    db_custodian = models.Custodian(**custodian.model_dump(), user_id=user_id)
    db.add(db_custodian)
    if commit:
        await db.commit()
        await db.refresh(db_custodian)
    else:
        await db.flush()
    return db_custodian


async def update_custodian(
    db: AsyncSession,
    custodian_id: int,
    custodian_update: schemas.CustodianUpdate,
    user_id: int,
) -> Optional[models.Custodian]:
    result = await db.execute(
        select(models.Custodian).where(
            models.Custodian.id == custodian_id, models.Custodian.user_id == user_id
        )
    )
    db_custodian = result.scalar_one_or_none()

    if not db_custodian:
        return None

    update_data = custodian_update.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(db_custodian, key, value)

    db.add(db_custodian)
    await db.commit()
    await db.refresh(db_custodian)
    return db_custodian


async def delete_custodian(db: AsyncSession, custodian_id: int, user_id: int) -> bool:
    result = await db.execute(
        select(models.Custodian).where(
            models.Custodian.id == custodian_id, models.Custodian.user_id == user_id
        )
    )
    db_custodian = result.scalar_one_or_none()

    if not db_custodian:
        return False

    await db.delete(db_custodian)
    await db.commit()
    return True


# Asset Types
async def get_asset_types(
    db: AsyncSession, user_id: int, skip: int = 0, limit: int = 100
) -> List[models.AssetType]:
    # Fetch system defaults and user specific types
    result = await db.execute(
        select(models.AssetType)
        .where(
        (models.AssetType.user_id == user_id) | (models.AssetType.user_id.is_(None))
        )
        .offset(skip)
        .limit(min(limit, 1000))  # Cap at 1000 to prevent memory exhaustion
    )
    return result.scalars().all()


async def create_asset_type(
    db: AsyncSession, asset_type: schemas.AssetTypeCreate, user_id: int
) -> models.AssetType:
    db_asset_type = models.AssetType(**asset_type.model_dump(), user_id=user_id)
    db.add(db_asset_type)
    await db.commit()
    await db.refresh(db_asset_type)
    return db_asset_type


async def update_asset_type(
    db: AsyncSession,
    asset_type_id: int,
    asset_type_update: schemas.AssetTypeUpdate,
    user_id: int,
) -> Optional[models.AssetType]:
    # Only allow updating user-owned asset types
    result = await db.execute(
        select(models.AssetType).where(
            models.AssetType.id == asset_type_id, models.AssetType.user_id == user_id
        )
    )
    db_asset_type = result.scalar_one_or_none()

    if not db_asset_type:
        return None

    update_data = asset_type_update.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(db_asset_type, key, value)

    db.add(db_asset_type)
    await db.commit()
    await db.refresh(db_asset_type)
    return db_asset_type


async def delete_asset_type(db: AsyncSession, asset_type_id: int, user_id: int) -> str:
    # Returns "ok", "not_found", "in_use", "system_default"

    # Check existence and ownership
    result = await db.execute(
        select(models.AssetType).where(models.AssetType.id == asset_type_id)
    )
    db_asset_type = result.scalar_one_or_none()

    if not db_asset_type:
        return "not_found"

    if db_asset_type.user_id is None:
        return "system_default"

    if db_asset_type.user_id != user_id:
        return "not_found"  # Treat other users' types as not found

    # Check if in use
    assets_in_use = await db.execute(
        select(models.Asset).where(models.Asset.asset_type_id == asset_type_id).limit(1)
    )
    if assets_in_use.first():
        return "in_use"

    await db.delete(db_asset_type)
    await db.commit()
    return "ok"


# Primary Groups
async def get_primary_groups(
    db: AsyncSession, user_id: int, skip: int = 0, limit: int = 100
) -> List[models.PrimaryGroup]:
    result = await db.execute(
        select(models.PrimaryGroup)
        .where(models.PrimaryGroup.user_id == user_id)
        .offset(skip)
        .limit(min(limit, 1000))  # Cap at 1000 to prevent memory exhaustion
    )
    return result.scalars().all()


async def create_primary_group(
    db: AsyncSession, group: schemas.PrimaryGroupCreate, user_id: int, commit: bool = True
) -> models.PrimaryGroup:
    db_group = models.PrimaryGroup(**group.model_dump(), user_id=user_id)
    db.add(db_group)
    if commit:
        await db.commit()
        await db.refresh(db_group)
    else:
        await db.flush()
    return db_group


# Assets


# ... (existing imports)


# Assets
async def get_assets(
    db: AsyncSession, user_id: int, skip: int = 0, limit: int = 100
) -> List[models.Asset]:
    result = await db.execute(
        select(models.Asset)
        .options(
            joinedload(models.Asset.asset_type),
            joinedload(models.Asset.custodian),
            joinedload(models.Asset.group),
            selectinload(models.Asset.tags),
        )
        .where(models.Asset.user_id == user_id)
        .offset(skip)
        .limit(min(limit, 1000))  # Cap at 1000 to prevent memory exhaustion
    )
    assets = result.scalars().all()

    if not assets:
        return assets

    # Batch fetch latest prices for all user's assets in a single query
    # This prevents N+1 query problem (was fetching price per asset in loop)
    asset_ids = [asset.id for asset in assets]

    # Use window function to get latest price per asset
    from sqlalchemy import func

    latest_prices_subq = (
        select(
            models.PriceHistory.asset_id,
            models.PriceHistory.price,
            func.row_number()
            .over(
                partition_by=models.PriceHistory.asset_id,
                order_by=desc(models.PriceHistory.date),
            )
            .label("rn"),
        )
        .where(models.PriceHistory.asset_id.in_(asset_ids))
        .subquery()
    )

    stmt = select(latest_prices_subq.c.asset_id, latest_prices_subq.c.price).where(
        latest_prices_subq.c.rn == 1
    )

    price_result = await db.execute(stmt)
    price_lookup = {row.asset_id: row.price for row in price_result}

    # Populate current_price using lookup dictionary
    for asset in assets:
        if asset.id in price_lookup:
            asset.current_price = price_lookup[asset.id]

    return assets


async def get_asset(
    db: AsyncSession, asset_id: int, user_id: int
) -> Optional[models.Asset]:
    result = await db.execute(
        select(models.Asset)
        .options(
            joinedload(models.Asset.asset_type),
            joinedload(models.Asset.custodian),
            joinedload(models.Asset.group),
            selectinload(models.Asset.tags),
        )
        .where(models.Asset.id == asset_id, models.Asset.user_id == user_id)
    )
    return result.scalar_one_or_none()


async def create_asset(
    db: AsyncSession, asset: schemas.AssetCreate, user_id: int, commit: bool = True
) -> models.Asset:
    # Use model_dump(exclude_unset=True) but handle quantity specially because it's on Asset but not in AssetBase
    asset_data = asset.model_dump(exclude={"quantity", "current_price", "tag_ids"})
    initial_quantity = asset.quantity

    # Handle Tags
    from .models import Tag

    tag_ids = asset.tag_ids or []
    tags = []
    if tag_ids:
        tag_stmt = select(Tag).where(Tag.id.in_(tag_ids), Tag.user_id == user_id)
        tags = (await db.execute(tag_stmt)).scalars().all()

    db_asset = models.Asset(
        **asset_data, quantity=initial_quantity, user_id=user_id, tags=tags
    )
    db.add(db_asset)
    
    if commit:
        await db.commit()
        await db.refresh(db_asset)
    else:
        await db.flush()

    # Create initial transaction if quantity > 0
    if initial_quantity > 0:
        transaction = models.Transaction(
            asset_id=db_asset.id,
            type=models.TransactionType.BUY,
            date=db_asset.purchase_date or utc_now(),
            quantity_change=initial_quantity,
            price_per_unit=db_asset.purchase_price or 0.0,
        )
        db.add(transaction)
        if commit:
            await db.commit()

    if commit:
        # Refresh to safely access id (since commit expires instance)
        await db.refresh(db_asset)
        # Re-fetch fully loaded asset to return
        return await get_asset(db, db_asset.id, user_id)
    
    return db_asset


async def update_asset(
    db: AsyncSession, asset_id: int, asset_update: schemas.AssetUpdate, user_id: int
) -> Optional[models.Asset]:
    # Fetch existing asset
    stmt = (
        select(models.Asset)
        .options(selectinload(models.Asset.tags))
        .where(models.Asset.id == asset_id, models.Asset.user_id == user_id)
    )
    result = await db.execute(stmt)
    db_asset = result.scalar_one_or_none()

    if not db_asset:
        return None

    update_data = asset_update.model_dump(exclude_unset=True, exclude={"tag_ids"})

    for key, value in update_data.items():
        setattr(db_asset, key, value)

    # Handle Tags update
    if asset_update.tag_ids is not None:
        from .models import Tag

        tag_stmt = select(Tag).where(
            Tag.id.in_(asset_update.tag_ids), Tag.user_id == user_id
        )
        tags = (await db.execute(tag_stmt)).scalars().all()
        db_asset.tags = tags

    db.add(db_asset)
    await db.commit()

    # Refresh to safely access id
    await db.refresh(db_asset)

    return await get_asset(db, db_asset.id, user_id)


async def delete_asset(db: AsyncSession, asset_id: int, user_id: int) -> bool:
    stmt = select(models.Asset).where(
        models.Asset.id == asset_id, models.Asset.user_id == user_id
    )
    result = await db.execute(stmt)
    db_asset = result.scalar_one_or_none()

    if not db_asset:
        return False

    await db.delete(db_asset)
    await db.commit()
    return True


async def create_transaction(
    db: AsyncSession, transaction: schemas.TransactionCreate, user_id: int, commit: bool = True
) -> models.Transaction:
    # Verify asset belongs to user
    asset = await get_asset(db, transaction.asset_id, user_id)
    if not asset:
        raise ValueError("Asset not found")

    db_transaction = models.Transaction(**transaction.model_dump())
    db.add(db_transaction)

    # Atomic database-level quantity update
    # Use synchronize_session=False to avoid lazy loading errors in async loops
    stmt = (
        update(models.Asset)
        .where(models.Asset.id == transaction.asset_id)
        .values(quantity=models.Asset.quantity + transaction.quantity_change)
        .execution_options(synchronize_session=False)
    )
    await db.execute(stmt)

    if commit:
        await db.commit()
        await db.refresh(db_transaction)
    else:
        await db.flush()
        
    return db_transaction


async def create_price_history(
    db: AsyncSession, price_history: schemas.PriceHistoryCreate, user_id: int, commit: bool = True
) -> models.PriceHistory:
    # Verify asset belongs to user (security check)
    stmt = select(models.Asset).where(
        models.Asset.id == price_history.asset_id, 
        models.Asset.user_id == user_id
    )
    result = await db.execute(stmt)
    if not result.scalar_one_or_none():
        raise ValueError("Asset not found or access denied")

    db_price_history = models.PriceHistory(**price_history.model_dump())
    db.add(db_price_history)
    
    if commit:
        await db.commit()
        await db.refresh(db_price_history)
    else:
        await db.flush()
        
    return db_price_history
