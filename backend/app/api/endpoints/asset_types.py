from typing import List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from app import crud, schemas
from app.database import get_db
from app.api.deps import get_effective_user_id

router = APIRouter()


@router.get("", response_model=List[schemas.AssetType])
async def read_asset_types(
    db: AsyncSession = Depends(get_db), user_id: int = Depends(get_effective_user_id)
):
    return await crud.get_asset_types(db, user_id=user_id)


@router.post("", response_model=schemas.AssetType)
async def create_asset_type(
    asset_type: schemas.AssetTypeCreate,
    db: AsyncSession = Depends(get_db),
    user_id: int = Depends(get_effective_user_id),
):
    return await crud.create_asset_type(db=db, asset_type=asset_type, user_id=user_id)


@router.put("/{asset_type_id}", response_model=schemas.AssetType)
async def update_asset_type(
    asset_type_id: int,
    asset_type: schemas.AssetTypeUpdate,
    db: AsyncSession = Depends(get_db),
    user_id: int = Depends(get_effective_user_id),
):
    updated = await crud.update_asset_type(
        db=db,
        asset_type_id=asset_type_id,
        asset_type_update=asset_type,
        user_id=user_id,
    )
    if not updated:
        raise HTTPException(
            status_code=404, detail="Asset type not found or cannot be modified"
        )
    return updated


@router.delete("/{asset_type_id}")
async def delete_asset_type(
    asset_type_id: int,
    db: AsyncSession = Depends(get_db),
    user_id: int = Depends(get_effective_user_id),
):
    result = await crud.delete_asset_type(
        db=db, asset_type_id=asset_type_id, user_id=user_id
    )

    if result == "not_found":
        raise HTTPException(status_code=404, detail="Asset type not found")
    elif result == "system_default":
        raise HTTPException(
            status_code=400, detail="Cannot delete system default asset types"
        )
    elif result == "in_use":
        raise HTTPException(
            status_code=400, detail="Cannot delete asset type that is in use by assets"
        )

    return {"message": "Asset type deleted successfully"}
