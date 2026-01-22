
from typing import List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app import models, schemas
from app.database import get_db
from app.api.deps import get_current_admin

router = APIRouter()

@router.get("", response_model=List[schemas.AssetTypeCategory])
async def read_asset_categories(
    db: AsyncSession = Depends(get_db),
    current_user: models.User = Depends(get_current_admin),
):
    """
    Get all asset type categories.
    """
    stmt = select(models.AssetTypeCategory).order_by(models.AssetTypeCategory.name)
    result = await db.execute(stmt)
    return result.scalars().all()

@router.post("", response_model=schemas.AssetTypeCategory)
async def create_asset_category(
    category_in: schemas.AssetTypeCategoryCreate,
    db: AsyncSession = Depends(get_db),
    current_user: models.User = Depends(get_current_admin),
):
    """
    Create a new asset type category.
    """
    existing = await db.execute(select(models.AssetTypeCategory).where(models.AssetTypeCategory.name == category_in.name))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Category with this name already exists")

    db_obj = models.AssetTypeCategory(**category_in.model_dump())
    db.add(db_obj)
    await db.commit()
    await db.refresh(db_obj)
    return db_obj

@router.put("/{category_id}", response_model=schemas.AssetTypeCategory)
async def update_asset_category(
    category_id: int,
    category_in: schemas.AssetTypeCategoryUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: models.User = Depends(get_current_admin),
):
    stmt = select(models.AssetTypeCategory).where(models.AssetTypeCategory.id == category_id)
    result = await db.execute(stmt)
    db_obj = result.scalar_one_or_none()
    
    if not db_obj:
        raise HTTPException(status_code=404, detail="Category not found")

    update_data = category_in.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(db_obj, field, value)

    db.add(db_obj)
    await db.commit()
    await db.refresh(db_obj)
    return db_obj

@router.delete("/{category_id}", response_model=schemas.AssetTypeCategory)
async def delete_asset_category(
    category_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: models.User = Depends(get_current_admin),
):
    stmt = select(models.AssetTypeCategory).where(models.AssetTypeCategory.id == category_id)
    result = await db.execute(stmt)
    db_obj = result.scalar_one_or_none()
    
    if not db_obj:
        raise HTTPException(status_code=404, detail="Category not found")
        
    if db_obj.is_system:
        raise HTTPException(status_code=400, detail="Cannot delete system categories")

    await db.delete(db_obj)
    await db.commit()
    return db_obj
