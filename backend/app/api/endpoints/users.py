from typing import Any, List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.api import deps
from app.models import User, UserShare
from app.schemas.auth import UserResponse, UserUpdate, PasswordResetRequest
from app.schemas.user_share import UserShare as UserShareSchema, UserShareCreate
from app.models import (
    # User,
    # UserShare,
    Asset,
    Custodian,
    AssetType,
    PrimaryGroup,
    Tag,
    AssetTag,
    Transaction,
    PriceHistory,
)

router = APIRouter()


@router.get("", response_model=List[UserResponse])
async def list_users(
    current_user: User = Depends(deps.get_current_active_user),
    db: AsyncSession = Depends(deps.get_db),
    skip: int = 0,
    limit: int = 100,
) -> Any:
    """
    List all users. Admin only.
    """
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Not enough permissions")

    result = await db.execute(select(User).offset(skip).limit(limit))
    return result.scalars().all()


@router.get("/me/access", response_model=List[UserResponse])
async def list_accessible_portfolios(
    current_user: User = Depends(deps.get_current_active_user),
    db: AsyncSession = Depends(deps.get_db),
) -> Any:
    """
    List users whose portfolios I can access.
    """
    # 1. My own portfolio
    accessible_users = [current_user]

    # 2. Portfolios shared with me
    stmt = (
        select(User)
        .join(UserShare, UserShare.owner_id == User.id)
        .where(UserShare.viewer_id == current_user.id)
    )
    result = await db.execute(stmt)
    shared_users = result.scalars().all()

    # 3. If admin, could list all, but that's too many.
    # Front-end can handle "Admin View" separately via regular user list.

    # Combine unique (though overlap shouldn't happen with current logic)
    for user in shared_users:
        if user.id != current_user.id:
            accessible_users.append(user)

    return accessible_users


@router.post("/{user_id}/share", response_model=UserShareSchema)
async def share_portfolio(
    user_id: int,  # The user ID who will RECEIVE access
    share_in: UserShareCreate,
    current_user: User = Depends(deps.get_current_active_user),
    db: AsyncSession = Depends(deps.get_db),
) -> Any:
    """
    Share my portfolio with another user.
    """
    # Check if target user exists
    target_user = await db.get(User, user_id)
    if not target_user:
        raise HTTPException(status_code=404, detail="User not found")

    # Check if already shared
    stmt = select(UserShare).where(
        UserShare.owner_id == current_user.id, UserShare.viewer_id == user_id
    )
    result = await db.execute(stmt)
    existing_share = result.scalar_one_or_none()

    if existing_share:
        # Update permission
        existing_share.permission = share_in.permission
        db.add(existing_share)
        await db.commit()
        await db.refresh(existing_share)
        return existing_share

    # Create new share
    new_share = UserShare(
        owner_id=current_user.id, viewer_id=user_id, permission=share_in.permission
    )
    db.add(new_share)
    await db.commit()
    await db.refresh(new_share)
    return new_share


@router.delete("/{user_id}/share", response_model=dict)
async def revoke_share(
    user_id: int,  # The user ID to REVOKE access from
    current_user: User = Depends(deps.get_current_active_user),
    db: AsyncSession = Depends(deps.get_db),
) -> Any:
    """
    Revoke access to my portfolio from another user.
    """
    stmt = select(UserShare).where(
        UserShare.owner_id == current_user.id, UserShare.viewer_id == user_id
    )
    result = await db.execute(stmt)
    share = result.scalar_one_or_none()

    if not share:
        raise HTTPException(status_code=404, detail="Share not found")

    await db.delete(share)
    await db.commit()
    return {"status": "success"}


# Admin endpoint to force share? Or just rely on admin status bypass?
# Admin status bypass is cleaner.


@router.post("/{user_id}/password", response_model=dict)
async def reset_password(
    user_id: int,
    reset_in: PasswordResetRequest,  # Ensure Import
    current_user: User = Depends(deps.get_current_active_user),
    db: AsyncSession = Depends(deps.get_db),
) -> Any:
    """
    Reset user password (Admin only).
    """
    from app.core import security

    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Not enough permissions")

    user = await db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    user.hashed_password = security.get_password_hash(reset_in.password)
    db.add(user)
    await db.commit()

    return {"status": "success", "message": "Password updated successfully"}


@router.patch("/{user_id}", response_model=UserResponse)
async def update_user(
    user_id: int,
    user_in: UserUpdate,  # Ensure Import
    current_user: User = Depends(deps.get_current_active_user),
    db: AsyncSession = Depends(deps.get_db),
) -> Any:
    """
    Update user status/role (Admin only).
    """
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Not enough permissions")

    user = await db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    if user_in.is_active is not None:
        user.is_active = user_in.is_active

    if user_in.is_admin is not None:
        user.is_admin = user_in.is_admin

    if user_in.settings is not None:
        # Merge or replace? Let's merge for safety, or replace if intent is full update
        # For admin update, usually full replace or specific key merge.
        # But here we just assume the dict passed is what we want to merge/set.
        # Simple merge:
        current_settings = user.settings or {}
        current_settings.update(user_in.settings)
        user.settings = current_settings
        # Force flag modified if using mutable JSON type? SQLAlchemy usually tracks it.
        # But re-assignment ensures it.

    db.add(user)
    await db.commit()
    await db.refresh(user)

    return user


@router.delete("/me", response_model=dict)
async def delete_me(
    current_user: User = Depends(deps.get_current_active_user),
    db: AsyncSession = Depends(deps.get_db),
) -> Any:
    """
    Delete own user account.
    """
    await _delete_user_data(db, current_user)
    return {"status": "success", "message": "User deleted successfully"}


@router.delete("/{user_id}", response_model=dict)
async def delete_user(
    user_id: int,
    current_user: User = Depends(deps.get_current_active_user),
    db: AsyncSession = Depends(deps.get_db),
) -> Any:
    """
    Delete a user (Admin only).
    """
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Not enough permissions")

    user = await db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    await _delete_user_data(db, user)
    return {"status": "success", "message": "User deleted successfully"}


async def _delete_user_data(db: AsyncSession, user: User):
    # 1. Delete Manual Shares
    await db.execute(
        select(UserShare)
        .where((UserShare.owner_id == user.id) | (UserShare.viewer_id == user.id))
        .execution_options(synchronize_session=False)
    )
    # We need to actually delete, not just select.
    # The above line was just selecting. SQLAlchemy delete statement:
    from sqlalchemy import delete

    # Delete Shares
    await db.execute(
        delete(UserShare).where(
            (UserShare.owner_id == user.id) | (UserShare.viewer_id == user.id)
        )
    )

    # 2. Delete Assets (Cascade to Txs and PriceHistory is configured in ORM but for bulk delete we might need to rely on DB cascade or manual)
    # Since we are doing bulk delete via SQL, ORM cascade "delete-orphan" doesn't trigger automatically unless we load objects.
    # So we should delete children first manually or trust DB foreign key cascade.
    # Given we didn't confirm DB schema has ON DELETE CASCADE, we delete manually.

    # Get all asset IDs to delete children
    result = await db.execute(select(Asset.id).where(Asset.user_id == user.id))
    asset_ids = result.scalars().all()

    if asset_ids:
        # Delete Transactions
        await db.execute(delete(Transaction).where(Transaction.asset_id.in_(asset_ids)))
        # Delete PriceHistory
        await db.execute(
            delete(PriceHistory).where(PriceHistory.asset_id.in_(asset_ids))
        )
        # Delete AssetTags (Many-to-Many)
        await db.execute(delete(AssetTag).where(AssetTag.asset_id.in_(asset_ids)))

    # Delete Assets
    await db.execute(delete(Asset).where(Asset.user_id == user.id))

    # 3. Delete supporting data
    await db.execute(delete(Custodian).where(Custodian.user_id == user.id))
    await db.execute(delete(AssetType).where(AssetType.user_id == user.id))
    await db.execute(delete(PrimaryGroup).where(PrimaryGroup.user_id == user.id))
    await db.execute(delete(Tag).where(Tag.user_id == user.id))

    # 4. User children (OAuth, WebAuthn, Tokens) - these have cascade="all, delete-orphan" in User model
    # BUT again, that works if we delete the User object via session.delete(user)
    # So we can just do that for the user itself.

    await db.delete(user)
    await db.commit()
