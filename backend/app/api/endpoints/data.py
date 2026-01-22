from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from app.database import get_db
from ...models import (
    User,
    Asset,
    Transaction,
    Custodian,
    AssetType,
    PrimaryGroup,
    Tag,
    PriceHistory,
)
from ..deps import get_current_user_id
from typing import List, Dict
from datetime import datetime, date
from decimal import Decimal
import json
from app.utils.datetime_utils import utc_now
from pydantic import BaseModel
from ...constants import MAX_IMPORT_FILE_SIZE, EXPORT_VERSION, CURRENCY_SETTING_KEYS

router = APIRouter()


# JSON serialization helper
def serialize_value(val):
    """Convert non-JSON-serializable types to JSON-compatible formats."""
    if val is None:
        return None
    if isinstance(val, (datetime, date)):
        return val.isoformat()
    if isinstance(val, Decimal):
        return float(val)
    return val


def model_to_dict(obj) -> dict:
    """Convert SQLAlchemy model to JSON-serializable dict."""
    return {
        c.name: serialize_value(getattr(obj, c.name)) for c in obj.__table__.columns
    }


@router.get("/counts")
async def get_data_counts(
    db: AsyncSession = Depends(get_db), user_id: int = Depends(get_current_user_id)
):
    """Get counts of all data types for granular export selection (user-scoped)"""

    # User-scoped counts
    asset_count = (
        await db.scalar(
            select(func.count()).select_from(Asset).where(Asset.user_id == user_id)
        )
        or 0
    )

    custodian_count = (
        await db.scalar(
            select(func.count())
            .select_from(Custodian)
            .where(Custodian.user_id == user_id)
        )
        or 0
    )

    # Transactions via asset ownership (Transaction doesn't have user_id)
    asset_ids_subq = select(Asset.id).where(Asset.user_id == user_id)
    tx_count = (
        await db.scalar(
            select(func.count())
            .select_from(Transaction)
            .where(Transaction.asset_id.in_(asset_ids_subq))
        )
        or 0
    )

    # Shared models (no user filter)
    asset_type_count = await db.scalar(select(func.count()).select_from(AssetType)) or 0
    group_count = await db.scalar(select(func.count()).select_from(PrimaryGroup)) or 0
    tag_count = await db.scalar(select(func.count()).select_from(Tag)) or 0

    return {
        "assets": asset_count,
        "transactions": tx_count,
        "custodians": custodian_count,
        "asset_types": asset_type_count,
        "groups": group_count,
        "tags": tag_count,
        "settings": 1,
        "currencies": 1,
        "value_history": await db.scalar(
            select(func.count())
            .select_from(PriceHistory)
            .join(Asset)
            .where(Asset.user_id == user_id, PriceHistory.source == "Manual")
        )
        or 0,
    }


@router.get("/export")
async def export_data(
    include: str = Query(
        "assets,transactions,custodians,asset_types,groups,tags,settings,currencies,value_history"
    ),
    db: AsyncSession = Depends(get_db),
    user_id: int = Depends(get_current_user_id),
):
    """Export selected data categories (user-specific data only)"""
    categories = include.split(",")
    export_data = {
        "metadata": {
            "version": EXPORT_VERSION,
            "date": utc_now().isoformat(),
            "exported_categories": categories,
            "user_id": user_id,
        }
    }

    # Export user settings (user-scoped)
    if "settings" in categories or "currencies" in categories:
        result = await db.execute(select(User).where(User.id == user_id))
        user = result.scalar_one_or_none()
        if user:
            current = user.settings or {}

            if "settings" in categories:
                # Exclude currency keys
                s_data = {
                    k: v for k, v in current.items() if k not in CURRENCY_SETTING_KEYS
                }
                export_data["settings"] = [s_data]

            if "currencies" in categories:
                # Include only currency keys
                c_data = {
                    k: v for k, v in current.items() if k in CURRENCY_SETTING_KEYS
                }
                export_data["currencies"] = [c_data]

    if "custodians" in categories:
        stmt = select(Custodian).where(Custodian.user_id == user_id)
        result = await db.execute(stmt)
        export_data["custodians"] = [model_to_dict(r) for r in result.scalars().all()]

    if "asset_types" in categories:
        result = await db.execute(select(AssetType))
        export_data["asset_types"] = [model_to_dict(r) for r in result.scalars().all()]

    if "groups" in categories:
        result = await db.execute(
            select(PrimaryGroup).where(PrimaryGroup.user_id == user_id)
        )
        export_data["groups"] = [model_to_dict(r) for r in result.scalars().all()]

    if "tags" in categories:
        result = await db.execute(select(Tag).where(Tag.user_id == user_id))
        export_data["tags"] = [model_to_dict(r) for r in result.scalars().all()]

    if "asset_tags" in categories or ("assets" in categories and "tags" in categories):
        from ...models import AssetTag

        asset_stmt = select(Asset.id).where(Asset.user_id == user_id)
        asset_ids = (await db.execute(asset_stmt)).scalars().all()
        stmt = select(AssetTag).where(AssetTag.asset_id.in_(asset_ids))
        result = await db.execute(stmt)
        export_data["asset_tags"] = [model_to_dict(r) for r in result.scalars().all()]

    # Assets depend on Custodians, Types, Groups
    if "assets" in categories:
        stmt = select(Asset).where(Asset.user_id == user_id)
        result = await db.execute(stmt)
        export_data["assets"] = [model_to_dict(r) for r in result.scalars().all()]

    # Transactions depend on Assets
    if "transactions" in categories:
        # Get user's asset IDs first
        asset_stmt = select(Asset.id).where(Asset.user_id == user_id)
        asset_ids = (await db.execute(asset_stmt)).scalars().all()

        stmt = select(Transaction).where(Transaction.asset_id.in_(asset_ids))
        result = await db.execute(stmt)
        export_data["transactions"] = [model_to_dict(r) for r in result.scalars().all()]

    if "value_history" in categories:
        # Get user's asset IDs
        asset_stmt = select(Asset.id).where(Asset.user_id == user_id)
        asset_ids = (await db.execute(asset_stmt)).scalars().all()

        stmt = select(PriceHistory).where(
            PriceHistory.asset_id.in_(asset_ids), PriceHistory.source == "Manual"
        )
        result = await db.execute(stmt)
        export_data["value_history"] = [
            model_to_dict(r) for r in result.scalars().all()
        ]

    return export_data


class ImportResult(BaseModel):
    success: bool
    summary: Dict[str, int]
    errors: List[str]


@router.post("/import")
async def import_data(
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    user_id: int = Depends(get_current_user_id),
):
    """Import data from JSON file (max 10MB)"""
    # Validate file size
    content = await file.read()
    if len(content) > MAX_IMPORT_FILE_SIZE:
        raise HTTPException(
            status_code=413,
            detail=f"File size exceeds maximum allowed size of {MAX_IMPORT_FILE_SIZE / (1024 * 1024):.0f}MB",
        )

    try:
        data = json.loads(content)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid JSON file: {str(e)}")

    summary = {
        "custodians": 0,
        "asset_types": 0,
        "groups": 0,
        "tags": 0,
        "assets": 0,
        "transactions": 0,
        "settings": 0,
        "currencies": 0,
        "value_history": 0,
    }
    errors = []

    # ID Mapping to handle foreign keys when IDs change (if we create new records)
    # Map old_id -> new_id
    id_map = {"custodians": {}, "asset_types": {}, "groups": {}, "assets": {}}

    # Helper to clean row data (remove id to let DB assign new one, convert dates)
    def clean_row(row, date_fields=[]):
        row_data = row.copy()
        old_id = row_data.pop("id", None)
        for field in date_fields:
            if row_data.get(field):
                try:
                    row_data[field] = datetime.fromisoformat(row_data[field])
                except ValueError:
                    pass
        return old_id, row_data

    # Helper to update settings (user-scoped)
    async def update_user_settings(new_values):
        result = await db.execute(select(User).where(User.id == user_id))
        user = result.scalar_one_or_none()
        if user:
            # Recursive merge helper if needed, but simple update is fine for now
            current_settings = user.settings or {}
            current_settings.update(new_values)

            # Force update flag if needed for SqlAlchemy JSON
            from sqlalchemy.orm.attributes import flag_modified

            user.settings = current_settings
            flag_modified(user, "settings")
            return True
        return False

    # 0. Settings (General)
    if (
        "settings" in data
        and isinstance(data["settings"], list)
        and len(data["settings"]) > 0
    ):
        try:
            if await update_user_settings(data["settings"][0]):
                summary["settings"] = 1
        except Exception as e:
            errors.append(f"Failed to import settings: {e}")

    # 0.5. Currencies
    if (
        "currencies" in data
        and isinstance(data["currencies"], list)
        and len(data["currencies"]) > 0
    ):
        try:
            if await update_user_settings(data["currencies"][0]):
                summary["currencies"] = 1
        except Exception as e:
            errors.append(f"Failed to import currencies: {e}")

    # 1. Custodians
    if "custodians" in data:
        for row in data["custodians"]:
            old_id, row_data = clean_row(row)
            # Ensure user_id is set
            row_data["user_id"] = user_id

            # Try to find existing by name and user_id
            stmt = select(Custodian).where(
                Custodian.name == row_data["name"], Custodian.user_id == user_id
            )
            result = await db.execute(stmt)
            existing = result.scalars().first()

            if existing:
                id_map["custodians"][old_id] = existing.id
            else:
                try:
                    new_obj = Custodian(**row_data)
                    db.add(new_obj)
                    await db.flush()
                    id_map["custodians"][old_id] = new_obj.id
                    summary["custodians"] += 1
                except Exception as e:
                    errors.append(
                        f"Failed to import custodian {row_data.get('name')}: {e}"
                    )

    # 2. Asset Types
    if "asset_types" in data:
        for row in data["asset_types"]:
            old_id, row_data = clean_row(row)
            stmt = select(AssetType).where(AssetType.name == row_data["name"])
            result = await db.execute(stmt)
            existing = result.scalars().first()

            if existing:
                id_map["asset_types"][old_id] = existing.id
            else:
                try:
                    new_obj = AssetType(**row_data)
                    db.add(new_obj)
                    await db.flush()
                    id_map["asset_types"][old_id] = new_obj.id
                    summary["asset_types"] += 1
                except Exception as e:
                    errors.append(
                        f"Failed to import asset type {row_data.get('name')}: {e}"
                    )

    # 3. Groups
    if "groups" in data:
        for row in data["groups"]:
            old_id, row_data = clean_row(row)
            stmt = select(PrimaryGroup).where(PrimaryGroup.name == row_data["name"])
            result = await db.execute(stmt)
            existing = result.scalars().first()

            if existing:
                id_map["groups"][old_id] = existing.id
            else:
                try:
                    new_obj = PrimaryGroup(**row_data)
                    db.add(new_obj)
                    await db.flush()
                    id_map["groups"][old_id] = new_obj.id
                    summary["groups"] += 1
                except Exception as e:
                    errors.append(
                        f"Failed to import group {row_data.get('name')}: {str(e)}"
                    )

    # 4. Tags
    if "tags" in data:
        for row in data["tags"]:
            old_id, row_data = clean_row(row)
            row_data["user_id"] = user_id
            stmt = select(Tag).where(
                Tag.name == row_data["name"], Tag.user_id == user_id
            )
            result = await db.execute(stmt)
            existing = result.scalars().first()
            if existing:
                id_map["tags"][old_id] = existing.id
            else:
                try:
                    new_obj = Tag(**row_data)
                    db.add(new_obj)
                    await db.flush()
                    id_map["tags"][old_id] = new_obj.id
                    summary["tags"] += 1
                except Exception as e:
                    errors.append(f"Failed to import tag {row_data.get('name')}: {e}")
        await db.flush()

    # 5. Assets
    if "assets" in data:
        for row in data["assets"]:
            old_id, row_data = clean_row(
                row, ["purchase_date", "created_at", "updated_at"]
            )
            # Ensure user_id is set
            row_data["user_id"] = user_id

            # Fix FKs using id_map with validation
            if row_data.get("custodian_id"):
                if row_data["custodian_id"] in id_map["custodians"]:
                    row_data["custodian_id"] = id_map["custodians"][
                        row_data["custodian_id"]
                    ]
                else:
                    errors.append(
                        f"Asset '{row_data.get('name')}': Unknown custodian_id {row_data['custodian_id']}"
                    )
                    continue

            if row_data.get("asset_type_id"):
                if row_data["asset_type_id"] in id_map["asset_types"]:
                    row_data["asset_type_id"] = id_map["asset_types"][
                        row_data["asset_type_id"]
                    ]
                else:
                    errors.append(
                        f"Asset '{row_data.get('name')}': Unknown asset_type_id {row_data['asset_type_id']}"
                    )
                    continue

            if row_data.get("group_id"):
                if row_data["group_id"] in id_map["groups"]:
                    row_data["group_id"] = id_map["groups"][row_data["group_id"]]
                else:
                    errors.append(
                        f"Asset '{row_data.get('name')}': Unknown group_id {row_data['group_id']}"
                    )
                    continue

            # Simple dedup check: Name + Ticker + user_id
            stmt = select(Asset).where(
                Asset.name == row_data["name"], Asset.user_id == user_id
            )
            if row_data.get("ticker_symbol"):
                stmt = stmt.where(Asset.ticker_symbol == row_data["ticker_symbol"])

            result = await db.execute(stmt)
            existing = result.scalars().first()

            if existing:
                id_map["assets"][old_id] = existing.id
            else:
                try:
                    new_obj = Asset(**row_data)
                    db.add(new_obj)
                    await db.flush()
                    id_map["assets"][old_id] = new_obj.id
                    summary["assets"] += 1
                except Exception as e:
                    errors.append(f"Failed to import asset {row_data.get('name')}: {e}")

    # 6. Transactions
    if "transactions" in data:
        for row in data["transactions"]:
            old_id, row_data = clean_row(row, ["date", "created_at"])

            # Fix FKs
            if row_data.get("asset_id") in id_map["assets"]:
                row_data["asset_id"] = id_map["assets"][row_data["asset_id"]]
            else:
                # Skip if asset not found/mapped
                continue

            if (
                row_data.get("dest_custodian_id")
                and row_data["dest_custodian_id"] in id_map["custodians"]
            ):
                row_data["dest_custodian_id"] = id_map["custodians"][
                    row_data["dest_custodian_id"]
                ]

            try:
                # Always insert transactions? Or dedup?
                # For now, let's try to find exact match on date + asset + quantity + type to avoid dupes
                stmt = select(Transaction).where(
                    Transaction.asset_id == row_data["asset_id"],
                    Transaction.date == row_data["date"],
                    Transaction.quantity_change == row_data["quantity_change"],
                    Transaction.type == row_data["type"],
                )
                result = await db.execute(stmt)
                existing = result.scalars().first()

                if not existing:
                    new_obj = Transaction(**row_data)
                    db.add(new_obj)
                    summary["transactions"] += 1
            except Exception as e:
                errors.append(f"Failed to import transaction {old_id}: {e}")

    # 7. Asset Tags (Many-to-Many)
    if "asset_tags" in data:
        from ...models import AssetTag

        for row in data["asset_tags"]:
            _, row_data = clean_row(row)

            new_asset_id = id_map["assets"].get(row_data.get("asset_id"))
            new_tag_id = id_map["tags"].get(row_data.get("tag_id"))

            if new_asset_id and new_tag_id:
                try:
                    # Check if exists
                    stmt = select(AssetTag).where(
                        AssetTag.asset_id == new_asset_id, AssetTag.tag_id == new_tag_id
                    )
                    existing = (await db.execute(stmt)).scalars().first()
                    if not existing:
                        db.add(AssetTag(asset_id=new_asset_id, tag_id=new_tag_id))
                except Exception as e:
                    errors.append(f"Failed to import asset-tag association: {e}")

    # 7. Value History
    if "value_history" in data:
        for row in data["value_history"]:
            old_id, row_data = clean_row(row, ["date"])

            # Fix FKs
            if row_data.get("asset_id") in id_map["assets"]:
                row_data["asset_id"] = id_map["assets"][row_data["asset_id"]]
            else:
                continue

            try:
                # Dedup check: date + asset + source="Manual"
                stmt = select(PriceHistory).where(
                    PriceHistory.asset_id == row_data["asset_id"],
                    PriceHistory.date == row_data["date"],
                    PriceHistory.source == "Manual",
                )
                result = await db.execute(stmt)
                existing = result.scalars().first()

                if not existing:
                    new_obj = PriceHistory(**row_data)
                    db.add(new_obj)
                    summary["value_history"] += 1
            except Exception as e:
                errors.append(f"Failed to import value history {old_id}: {e}")

    # Check if there were critical errors
    if errors:
        await db.rollback()
        return {"success": False, "summary": summary, "errors": errors}

    try:
        await db.commit()
        return {"success": True, "summary": summary, "errors": []}
    except Exception as e:
        await db.rollback()
        raise HTTPException(
            status_code=500, detail=f"Import failed and was rolled back: {str(e)}"
        )
