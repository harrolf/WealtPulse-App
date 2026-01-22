from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update
from app.database import get_db
from ...models import User
from ..deps import get_effective_user_id
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
from ...services.market import get_market_data


class SettingsUpdate(BaseModel):
    currencies: Optional[List[str]] = None
    main_currency: Optional[str] = None
    secondary_currencies: Optional[List[str]] = None
    market_data: Optional[Dict[str, Any]] = None
    time_format: Optional[str] = None
    date_format: Optional[str] = None
    number_format: Optional[str] = None
    timezone: Optional[str] = None


router = APIRouter()


@router.get("")
async def get_settings(
    db: AsyncSession = Depends(get_db), user_id: int = Depends(get_effective_user_id)
):
    """Get all user settings"""
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalars().first()

    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    # Default settings structure
    default_settings = {
        "currencies": ["CHF", "USD", "EUR", "CAD", "GBP", "BTC"],
        "main_currency": "CHF",
        "secondary_currencies": ["USD", "EUR", "CAD", "BTC"],
        "market_data": {
            "use_mock_data": False,
            "retention": {"high_res_limit_days": 7, "medium_res_limit_days": 60},
        },
        "time_format": "auto",
        "date_format": "auto",
        "number_format": "auto",
        "timezone": "auto",
    }

    current_settings = dict(user.settings) if user.settings else {}

    # Merge defaults (ensure keys exist)
    for key, val in default_settings.items():
        if key not in current_settings:
            current_settings[key] = val

    # Also ensure market_data sub-keys exist
    if "market_data" in current_settings:
        md = current_settings["market_data"]
        defaults = default_settings["market_data"]
        for k, v in defaults.items():
            if k not in md:
                md[k] = v
        if "retention" in md:
            ret_defs = defaults["retention"]
            for k, v in ret_defs.items():
                if k not in md["retention"]:
                    md["retention"][k] = v
    else:
        current_settings["market_data"] = default_settings["market_data"]

    return current_settings


@router.put("")
async def update_settings(
    settings_update: SettingsUpdate,
    db: AsyncSession = Depends(get_db),
    user_id: int = Depends(get_effective_user_id),
):
    """Update user settings"""
    try:
        with open("debug_settings.log", "a") as f:
            f.write(
                f"DEBUG SETTINGS UPDATE REQUEST: user_id={user_id}, body={settings_update}\n"
            )
    except Exception as e:
        print(f"Failed to write log: {e}")

    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalars().first()

    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    # We must start with existing settings to preserve other keys
    current_settings = dict(user.settings) if user.settings else {}

    # Update provided fields
    if settings_update.currencies is not None:
        current_settings["currencies"] = settings_update.currencies

    if settings_update.main_currency is not None:
        current_settings["main_currency"] = settings_update.main_currency

    if settings_update.secondary_currencies is not None:
        current_settings["secondary_currencies"] = settings_update.secondary_currencies

    if settings_update.time_format is not None:
        current_settings["time_format"] = settings_update.time_format

    if settings_update.date_format is not None:
        print(f"DEBUG EXPLICIT UPDATE: date_format={settings_update.date_format}")
        current_settings["date_format"] = settings_update.date_format

    if settings_update.number_format is not None:
        current_settings["number_format"] = settings_update.number_format

    if settings_update.timezone is not None:
        current_settings["timezone"] = settings_update.timezone

    if settings_update.market_data is not None:
        # Deep merge instead of overwrite to preserve fields?
        # For simple config, overwrite or merge is fine. Let's merge top level keys.
        if "market_data" not in current_settings:
            current_settings["market_data"] = {}

        current_md = current_settings["market_data"]
        new_md = settings_update.market_data

        for k, v in new_md.items():
            current_md[k] = v

        # Update service singleton immediately
        get_market_data().update_config(current_md)

    # Force a new dict to ensure SQLAlchemy detects change if using ORM, though we use update() stmt here
    stmt = update(User).where(User.id == user_id).values(settings=current_settings)
    await db.execute(stmt)
    await db.commit()

    return current_settings
