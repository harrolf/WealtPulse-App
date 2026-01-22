
from typing import List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app import models, schemas
from app.database import get_db
from app.api.deps import get_current_admin

router = APIRouter()

@router.get("", response_model=List[schemas.AssetType])
async def read_system_asset_types(
    db: AsyncSession = Depends(get_db),
    current_user: models.User = Depends(get_current_admin),
):
    """
    Get all system asset types (where user_id is None).
    Also merges display_config from the associated Category if not set on the AssetType.
    """
    # Fetch all categories first for lookup
    cat_stmt = select(models.AssetTypeCategory)
    cat_result = await db.execute(cat_stmt)
    categories_by_id = {cat.id: cat for cat in cat_result.scalars().all()}
    # Keep name map for fallback if category_id is missing but category string exists
    categories_by_name = {cat.name: cat for cat in categories_by_id.values()}

    stmt = select(models.AssetType).where(models.AssetType.user_id.is_(None)).order_by(models.AssetType.id)
    result = await db.execute(stmt)
    asset_types = result.scalars().all()

    # Merge config dynamically
    for at in asset_types:
        cat_obj = None
        if at.category_id in categories_by_id:
            cat_obj = categories_by_id[at.category_id]
        elif at.category in categories_by_name:
            cat_obj = categories_by_name[at.category]

        if not at.display_config and cat_obj:
             at.display_config = cat_obj.display_config or {}
        
        # Ensure category string is populated for backward compatibility/frontend display if ID is present
        if not at.category and cat_obj:
            at.category = cat_obj.name
    
    return asset_types

@router.post("", response_model=schemas.AssetType)
async def create_system_asset_type(
    asset_type: schemas.AssetTypeCreate,
    db: AsyncSession = Depends(get_db),
    current_user: models.User = Depends(get_current_admin),
):
    """
    Create a new system asset type.
    """
    # Check for name uniqueness among system types
    existing = await db.execute(select(models.AssetType).where(
        models.AssetType.name == asset_type.name,
        models.AssetType.user_id.is_(None)
    ))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="System asset type with this name already exists.")

    db_obj = models.AssetType(**asset_type.model_dump(), user_id=None)
    db.add(db_obj)
    await db.commit()
    await db.refresh(db_obj)
    return db_obj

@router.put("/{asset_type_id}", response_model=schemas.AssetType)
async def update_system_asset_type(
    asset_type_id: int,
    asset_type_in: schemas.AssetTypeUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: models.User = Depends(get_current_admin),
):
    """
    Update a system asset type.
    """
    stmt = select(models.AssetType).where(
        models.AssetType.id == asset_type_id,
        models.AssetType.user_id.is_(None)
    )
    result = await db.execute(stmt)
    db_obj = result.scalar_one_or_none()
    
    if not db_obj:
        raise HTTPException(status_code=404, detail="System asset type not found")

    update_data = asset_type_in.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(db_obj, field, value)

    db.add(db_obj)
    await db.commit()
    await db.refresh(db_obj)
    return db_obj

@router.delete("/{asset_type_id}")
async def delete_system_asset_type(
    asset_type_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: models.User = Depends(get_current_admin),
):
    """
    Delete a system asset type.
    Refuses delete if any assets are using it.
    """
    stmt = select(models.AssetType).where(
        models.AssetType.id == asset_type_id,
        models.AssetType.user_id.is_(None)
    )
    result = await db.execute(stmt)
    db_obj = result.scalar_one_or_none()
    
    if not db_obj:
        raise HTTPException(status_code=404, detail="System asset type not found")

    # Check usage
    usage_stmt = select(models.Asset).where(models.Asset.asset_type_id == asset_type_id).limit(1)
    usage_result = await db.execute(usage_stmt)
    if usage_result.first():
        raise HTTPException(status_code=400, detail="Cannot delete asset type that is in use by assets.")

    await db.delete(db_obj)
    await db.commit()
    return {"message": "Asset type deleted successfully"}
