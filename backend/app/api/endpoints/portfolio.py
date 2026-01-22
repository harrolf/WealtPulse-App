from typing import Optional
import datetime
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.api.deps import get_effective_user_id
from app.services.portfolio.service import PortfolioService
from app.schemas.common import (
    PortfolioSummaryResponse,
    HistoryResponse,
    AllocationResponse,
    PerformanceSummaryResponse,
)

router = APIRouter()


@router.get("/summary", response_model=PortfolioSummaryResponse)
async def get_portfolio_summary(
    date: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    user_id: int = Depends(get_effective_user_id),
):
    """
    Get portfolio summary including total value and asset list.
    Optionally for a specific historical date (YYYY-MM-DD).
    """
    target_date = None
    if date:
        try:
            target_date = datetime.date.fromisoformat(date)
        except ValueError:
            pass  # Or 400

    return await PortfolioService.get_summary(db, user_id, target_date)


@router.get("/history", response_model=HistoryResponse)
async def get_portfolio_history(
    time_range: str = "30d",
    db: AsyncSession = Depends(get_db),
    user_id: int = Depends(get_effective_user_id),
):
    """
    Get portfolio value history chart data.
    """
    return await PortfolioService.get_history(db, user_id, time_range)


@router.get("/allocation", response_model=AllocationResponse)
async def get_portfolio_allocation(
    db: AsyncSession = Depends(get_db), user_id: int = Depends(get_effective_user_id)
):

    """
    Get portfolio allocation breakdown.
    Refactored to calculate from Summary for consistency.
    """
    # Reuse summary logic to get valued assets
    summary = await PortfolioService.get_summary(db, user_id)
    assets = summary.get("assets", [])
    total_val = summary.get("total_value", 0)

    # helper
    def group_by(key_func, name_map=None):
        groups = {}
        for a in assets:
            k = key_func(a)
            if not k:
                k = "Other"
            val = a.get("value", 0)
            if k not in groups:
                groups[k] = 0
            groups[k] += val

        # Transform to list for Recharts
        result = []
        for k, v in groups.items():
            result.append({"name": k, "value": float(round(v, 2))})
        return result

    return {
        "by_asset_type": group_by(lambda a: a.get("type")),
        "by_category": group_by(lambda a: a.get("category")),
        "by_currency": group_by(lambda a: a.get("asset_currency")),
        "by_custodian": group_by(lambda a: a.get("custodian")),
        "by_group": group_by(lambda a: a.get("primary_group")),
        "by_tag": PortfolioService._group_assets_by_tag(assets),
        "total": total_val,
    }


@router.get("/performance/summary", response_model=PerformanceSummaryResponse)
async def get_performance_summary(
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    user_id: int = Depends(get_effective_user_id),
):
    """
    Get performance summary stats.
    """
    s_date = datetime.date.fromisoformat(start_date) if start_date else None
    e_date = datetime.date.fromisoformat(end_date) if end_date else None

    return await PortfolioService.get_performance_summary(db, user_id, s_date, e_date)


@router.get("/performance/detail")
async def get_performance_detail(
    time_range: str = "1y",
    db: AsyncSession = Depends(get_db),
    user_id: int = Depends(get_effective_user_id),
):
    """
    Get detailed performance chart data.
    """
    return await PortfolioService.get_performance_detail(db, user_id, time_range)
