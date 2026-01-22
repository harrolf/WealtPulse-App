from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Literal, Optional
from datetime import datetime, timedelta, date as date_obj

from app.database import get_db
from app.api.deps import get_current_user_id
from app.services.portfolio.service import PortfolioService
from app.utils.datetime_utils import utc_now

router = APIRouter()

TimeframeStr = Literal["1d", "1w", "1m", "3m", "ytd", "1y", "all"]


@router.get("/summary")
async def get_portfolio_performance(
    timeframe: TimeframeStr = "1m",
    start_date: Optional[str] = None,  # Optional: YYYY-MM-DD
    end_date: Optional[str] = None,  # Optional: YYYY-MM-DD
    db: AsyncSession = Depends(get_db),
    user_id: int = Depends(get_current_user_id),
):
    """
    Get portfolio performance percentage.
    Refactored to use PortfolioService.
    """
    # 1. Determine Dates
    current_date_obj: date_obj = utc_now().date()

    if end_date:
        try:
            current_date_obj = datetime.strptime(end_date, "%Y-%m-%d").date()
        except ValueError:
            pass  # Fallback to today

    start_date_obj: date_obj

    if start_date:
        try:
            start_date_obj = datetime.strptime(start_date, "%Y-%m-%d").date()
        except ValueError:
            # Fallback to timeframe logic
            start_date_obj = current_date_obj - timedelta(days=30)
    else:
        # Calculate from Timeframe relative to End Date
        if timeframe == "1w":
            start_date_obj = current_date_obj - timedelta(days=7)
        elif timeframe == "1d":
            start_date_obj = current_date_obj - timedelta(days=1)
        elif timeframe == "1m":
            start_date_obj = current_date_obj - timedelta(days=30)
        elif timeframe == "3m":
            start_date_obj = current_date_obj - timedelta(days=90)
        elif timeframe == "ytd":
            start_date_obj = date_obj(current_date_obj.year, 1, 1)
        elif timeframe == "1y":
            start_date_obj = current_date_obj - timedelta(days=365)
        elif timeframe == "all":
            start_date_obj = current_date_obj - timedelta(days=365 * 5)
        else:
            start_date_obj = current_date_obj - timedelta(days=30)

    # 2. Delegate to Service
    result = await PortfolioService.get_performance(
        db, user_id, start_date_obj, current_date_obj
    )

    # Add timeframe back to response if needed or frontend handles it
    result["timeframe"] = timeframe
    result["timeframe"] = timeframe
    return result


@router.get("/detail")
async def get_performance_detail(
    time_range: str = "1y",
    db: AsyncSession = Depends(get_db),
    user_id: int = Depends(get_current_user_id),
):
    """
    Get detailed performance metrics and chart.
    """
    return await PortfolioService.get_performance_detail(db, user_id, time_range)
