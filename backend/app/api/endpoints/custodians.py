from typing import List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from app import crud, schemas
from app.database import get_db
from ..deps import get_effective_user_id

router = APIRouter()


@router.get("", response_model=List[schemas.Custodian])
async def read_custodians(
    skip: int = 0,
    limit: int = 100,
    db: AsyncSession = Depends(get_db),
    user_id: int = Depends(get_effective_user_id),
):
    custodians = await crud.get_custodians(db, user_id=user_id, skip=skip, limit=limit)
    return custodians


@router.post("", response_model=schemas.Custodian)
async def create_custodian(
    custodian: schemas.CustodianCreate,
    db: AsyncSession = Depends(get_db),
    user_id: int = Depends(get_effective_user_id),
):
    return await crud.create_custodian(db=db, custodian=custodian, user_id=user_id)


@router.put("/{custodian_id}", response_model=schemas.Custodian)
async def update_custodian(
    custodian_id: int,
    custodian_update: schemas.CustodianUpdate,
    db: AsyncSession = Depends(get_db),
    user_id: int = Depends(get_effective_user_id),
):
    custodian = await crud.update_custodian(db, custodian_id, custodian_update, user_id)
    if custodian is None:
        raise HTTPException(status_code=404, detail="Custodian not found")
    return custodian


@router.delete("/{custodian_id}")
async def delete_custodian(
    custodian_id: int,
    db: AsyncSession = Depends(get_db),
    user_id: int = Depends(get_effective_user_id),
):
    success = await crud.delete_custodian(db, custodian_id, user_id)
    if not success:
        raise HTTPException(status_code=404, detail="Custodian not found")
    return {"status": "success"}
