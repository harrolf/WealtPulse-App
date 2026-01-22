from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from app import crud, schemas
from app.database import get_db
from ...validators.transaction_validator import TransactionValidator
from ..deps import get_current_user_id

router = APIRouter()




@router.post("", response_model=schemas.Transaction)
async def create_transaction(
    transaction: schemas.TransactionCreate,
    db: AsyncSession = Depends(get_db),
    user_id: int = Depends(get_current_user_id),
):
    # Fetch asset for validation
    asset = await crud.get_asset(db, transaction.asset_id, user_id)
    if not asset:
        raise HTTPException(status_code=404, detail="Asset not found")

    try:
        TransactionValidator.validate_transaction(transaction, asset, asset.quantity)
        return await crud.create_transaction(
            db=db, transaction=transaction, user_id=user_id
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception:
        await db.rollback()
        raise HTTPException(
            status_code=500, detail="Internal server error during transaction creation"
        )
