from typing import List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app import crud, schemas
from app.database import get_db
from ..deps import get_effective_user_id
from ...models import PrimaryGroup, Tag

router = APIRouter()


@router.get("/groups", response_model=List[schemas.PrimaryGroup])
async def read_groups(
    db: AsyncSession = Depends(get_db), user_id: int = Depends(get_effective_user_id)
):
    return await crud.get_primary_groups(db, user_id=user_id)


@router.post("/groups", response_model=schemas.PrimaryGroup)
async def create_group(
    group: schemas.PrimaryGroupCreate,
    db: AsyncSession = Depends(get_db),
    user_id: int = Depends(get_effective_user_id),
):
    return await crud.create_primary_group(db=db, group=group, user_id=user_id)


@router.put("/groups/{group_id}", response_model=schemas.PrimaryGroup)
async def update_group(
    group_id: int,
    group: schemas.PrimaryGroupUpdate,
    db: AsyncSession = Depends(get_db),
    user_id: int = Depends(get_effective_user_id),
):
    db_group = await db.get(PrimaryGroup, group_id)
    if not db_group or db_group.user_id != user_id:
        raise HTTPException(status_code=404, detail="Group not found")

    for key, value in group.model_dump(exclude_unset=True).items():
        setattr(db_group, key, value)

    await db.commit()
    await db.refresh(db_group)
    return db_group


@router.delete("/groups/{group_id}")
async def delete_group(
    group_id: int,
    db: AsyncSession = Depends(get_db),
    user_id: int = Depends(get_effective_user_id),
):
    db_group = await db.get(PrimaryGroup, group_id)
    if not db_group or db_group.user_id != user_id:
        raise HTTPException(status_code=404, detail="Group not found")

    await db.delete(db_group)
    await db.commit()
    return {"success": True}


@router.get("/tags", response_model=List[schemas.Tag])
async def read_tags(
    db: AsyncSession = Depends(get_db), user_id: int = Depends(get_effective_user_id)
):
    result = await db.execute(select(Tag).where(Tag.user_id == user_id))
    return result.scalars().all()


@router.post("/tags", response_model=schemas.Tag)
async def create_tag(
    tag: schemas.TagCreate,
    db: AsyncSession = Depends(get_db),
    user_id: int = Depends(get_effective_user_id),
):
    db_tag = Tag(**tag.model_dump(), user_id=user_id)
    db.add(db_tag)
    await db.commit()
    await db.refresh(db_tag)
    return db_tag


@router.put("/tags/{tag_id}", response_model=schemas.Tag)
async def update_tag(
    tag_id: int,
    tag: schemas.TagUpdate,
    db: AsyncSession = Depends(get_db),
    user_id: int = Depends(get_effective_user_id),
):
    db_tag = await db.get(Tag, tag_id)
    if not db_tag or db_tag.user_id != user_id:
        raise HTTPException(status_code=404, detail="Tag not found")

    for key, value in tag.model_dump(exclude_unset=True).items():
        setattr(db_tag, key, value)

    await db.commit()
    await db.refresh(db_tag)
    return db_tag


@router.delete("/tags/{tag_id}")
async def delete_tag(
    tag_id: int,
    db: AsyncSession = Depends(get_db),
    user_id: int = Depends(get_effective_user_id),
):
    db_tag = await db.get(Tag, tag_id)
    if not db_tag or db_tag.user_id != user_id:
        raise HTTPException(status_code=404, detail="Tag not found")

    await db.delete(db_tag)
    await db.commit()
    return {"success": True}
