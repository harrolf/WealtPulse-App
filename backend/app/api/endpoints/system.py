from typing import List, Dict, Any, Optional
import datetime
from datetime import date
from pydantic import BaseModel
from app import schemas
from ...api.deps import get_current_user_id, get_optional_user_id
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks, Query
from ...services.job_registry import get_job_registry
from ...services.monitoring import get_monitor
from ...agents.history_backfill import HistoryBackfillAgent
import psutil
import os
import time
from sqlalchemy import select, and_, func
from ...core.config import settings
from app.database import SessionLocal, get_db
from ...utils.datetime_utils import utc_now
from app.models import ExchangeRateHistory, SystemSetting, User
from ..deps import get_current_admin
from sqlalchemy.ext.asyncio import AsyncSession

router = APIRouter()


@router.get("/jobs", response_model=List[Dict[str, Any]])
async def get_jobs(user_id: int = Depends(get_current_user_id)):
    """
    Get status of all system agents/jobs.
    """
    registry = get_job_registry()
    return registry.get_all_jobs()


@router.get("/status")
async def get_system_status(user_id: int = Depends(get_current_user_id)):
    """
    Get overall system status and health metrics.
    """
    monitor = get_monitor()

    # Ensure we have at least Yahoo Finance status
    # In a real app, this would be updated by the MarketDataService periodically
    # For now, we'll check it here or ensure it's seeded

    # System Resources

    process = psutil.Process(os.getpid())
    mem_info = psutil.virtual_memory()
    disk_info = psutil.disk_usage("/")

    resources = {
        "cpu_usage": psutil.cpu_percent(interval=None),
        "memory_used_mb": int(mem_info.used / (1024 * 1024)),
        "memory_total_mb": int(mem_info.total / (1024 * 1024)),
        "memory_percent": mem_info.percent,
        "disk_percent": disk_info.percent,
        "disk_free_gb": int(disk_info.free / (1024 * 1024 * 1024)),
        "app_uptime_seconds": int(time.time() - process.create_time()),
        "app_memory_mb": int(process.memory_info().rss / (1024 * 1024)),
    }

    # DB Status Check
    db_status = "Unknown"
    db_last_updated = None
    db_latency_ms: float = 0.0
    try:
        # Check DB connection
        t0 = time.time()
        async with SessionLocal() as db:
            await db.execute(select(1))
        t1 = time.time()
        db_latency_ms = (t1 - t0) * 1000
        db_status = "Online"
        db_last_updated = utc_now().isoformat()
    except Exception as e:
        monitor.log_event("ERROR", f"Database check failed: {str(e)}", "System")
        db_status = "Offline"

    return {
        "app_version": settings.APP_VERSION,
        "resources": resources,
        "integrations": [
            {
                "service": "Database",
                "provider": "PostgreSQL",
                "status": db_status,
                "update_frequency": "Real-time",
                "last_updated": db_last_updated,
                "details": {"latency": f"{db_latency_ms:.2f}ms"},
            },
            {
                "service": "Yahoo Finance",
                "provider": "yfinance",
                "status": monitor._components_status.get("Market Data", {}).get(
                    "status", "Unknown"
                ),
                "update_frequency": "Real-time",
                "last_updated": monitor._components_status.get("Market Data", {}).get(
                    "last_updated"
                ),
                "details": monitor._components_status.get("Market Data", {}).get(
                    "details", {}
                ),
            },
        ],
    }


@router.get("/logs", response_model=List[Dict[str, Any]])
async def get_system_logs(
    lines: int = 100, 
    user_id: int = Depends(get_current_user_id)
):
    """
    Get recent system logs (persisted).
    """
    monitor = get_monitor()
    return await monitor.get_logs_from_db(limit=lines)


class JobRunParams(BaseModel):
    currency: Optional[str] = None
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    force: bool = False


@router.post("/jobs/{name}/run")
async def run_job(
    name: str,
    background_tasks: BackgroundTasks,
    params: Optional[JobRunParams] = None,
    user_id: int = Depends(get_current_user_id),
):
    """
    Manually trigger a job by name.
    """
    # Dispatcher logic
    if name == "Market Data Backfill":
        agent = HistoryBackfillAgent.get_instance()

        kwargs: Dict[str, Any] = {}
        if params:
            if params.currency:
                kwargs["currency"] = params.currency
            if params.start_date:
                kwargs["start_date"] = params.start_date
            if params.end_date:
                kwargs["end_date"] = params.end_date
            if params.force:
                kwargs["force"] = params.force

        background_tasks.add_task(agent.run, **kwargs)
        return {"message": f"Job {name} started"}

    raise HTTPException(status_code=404, detail="Job not found")


@router.get("/market-data", response_model=schemas.MarketDataList)
async def get_market_data_history(
    currency: Optional[str] = Query(None),
    start_date: Optional[date] = Query(None),
    end_date: Optional[date] = Query(None),
    limit: int = Query(50, ge=1, le=1000),
    offset: int = Query(0, ge=0),
    sort_by: str = Query(
        "date_desc", regex="^(date_asc|date_desc|rate_asc|rate_desc)$"
    ),
    user_id: int = Depends(get_current_user_id),
):
    """
    Explore historical exchange rate data with filters and pagination.
    """

    async with SessionLocal() as db:
        stmt = select(ExchangeRateHistory)

        filters: List[Any] = []
        # Always exclude NULL and NaN rates
        filters.append(ExchangeRateHistory.rate.isnot(None))
        # NaN values fail the equality check (NaN != NaN), so this filters them out
        filters.append(ExchangeRateHistory.rate == ExchangeRateHistory.rate)

        if currency:
            filters.append(ExchangeRateHistory.currency == currency.upper())
        if start_date:
            filters.append(
                ExchangeRateHistory.timestamp
                >= datetime.datetime.combine(start_date, datetime.time.min)
            )
        if end_date:
            filters.append(
                ExchangeRateHistory.timestamp
                <= datetime.datetime.combine(end_date, datetime.time.max)
            )

        if filters:
            stmt = stmt.where(and_(*filters))

        # Get Total Count
        count_stmt = select(func.count()).select_from(ExchangeRateHistory)
        if filters:
            count_stmt = count_stmt.where(and_(*filters))
        total = (await db.execute(count_stmt)).scalar() or 0

        # Sorting
        if sort_by == "date_desc":
            stmt = stmt.order_by(ExchangeRateHistory.timestamp.desc())
        elif sort_by == "date_asc":
            stmt = stmt.order_by(ExchangeRateHistory.timestamp.asc())
        elif sort_by == "rate_desc":
            stmt = stmt.order_by(ExchangeRateHistory.rate.desc())
        elif sort_by == "rate_asc":
            stmt = stmt.order_by(ExchangeRateHistory.rate.asc())

        stmt = stmt.offset(offset).limit(limit)

        result = await db.execute(stmt)
        items = result.scalars().all()
        return {"items": items, "total": total}


@router.get("/market-data/stats")
async def get_market_data_stats(
    currency: Optional[str] = Query(None), user_id: int = Depends(get_current_user_id)
):
    """
    Get statistics for market data density (daily and monthly counts).
    """

    async with SessionLocal() as db:
        # Detect database dialect for compatibility
        db_dialect = db.bind.dialect.name

        # 1. Daily Counts - Works for both SQLite and PostgreSQL
        if db_dialect == "sqlite":
            daily_stmt = select(
                func.date(ExchangeRateHistory.timestamp).label("date"),
                func.count(ExchangeRateHistory.id).label("count"),
            )
        else:  # PostgreSQL
            daily_stmt = select(
                func.date(ExchangeRateHistory.timestamp).label("date"),
                func.count(ExchangeRateHistory.id).label("count"),
            )

        if currency:
            daily_stmt = daily_stmt.where(
                ExchangeRateHistory.currency == currency.upper()
            )
        daily_stmt = daily_stmt.group_by(func.date(ExchangeRateHistory.timestamp))
        daily_result = await db.execute(daily_stmt)
        daily_data = {str(row.date): row.count for row in daily_result}

        # 1b. Daily Breakdown (for Stacked Bar Charts)
        # We need (Date, Currency) -> Count
        if db_dialect == "sqlite":
             breakdown_stmt = select(
                func.date(ExchangeRateHistory.timestamp).label("date"),
                ExchangeRateHistory.currency,
                func.count(ExchangeRateHistory.id).label("count"),
            )
        else:
             breakdown_stmt = select(
                func.date(ExchangeRateHistory.timestamp).label("date"),
                ExchangeRateHistory.currency,
                func.count(ExchangeRateHistory.id).label("count"),
            )
        
        if currency:
            breakdown_stmt = breakdown_stmt.where(ExchangeRateHistory.currency == currency.upper())
            
        breakdown_stmt = breakdown_stmt.group_by(func.date(ExchangeRateHistory.timestamp), ExchangeRateHistory.currency)
        breakdown_res = await db.execute(breakdown_stmt)
        
        # Transform to: { "2023-01-01": { "USD": 1, "EUR": 1 } }
        daily_breakdown = {}
        for row in breakdown_res:
             d_str = str(row.date)
             if d_str not in daily_breakdown:
                 daily_breakdown[d_str] = {}
             daily_breakdown[d_str][row.currency] = row.count


        # 2. Monthly Counts - Database-agnostic approach
        if db_dialect == "sqlite":
            # SQLite uses strftime
            monthly_stmt = select(
                func.strftime("%Y-%m", ExchangeRateHistory.timestamp).label("month"),
                func.count(ExchangeRateHistory.id).label("count"),
            )
        else:  # PostgreSQL
            # PostgreSQL uses to_char
            monthly_stmt = select(
                func.to_char(ExchangeRateHistory.timestamp, "YYYY-MM").label("month"),
                func.count(ExchangeRateHistory.id).label("count"),
            )

        if currency:
            monthly_stmt = monthly_stmt.where(
                ExchangeRateHistory.currency == currency.upper()
            )
        monthly_stmt = monthly_stmt.group_by("month")
        monthly_result = await db.execute(monthly_stmt)
        monthly_data = {row.month: row.count for row in monthly_result}

        # 3. Available Years - Database-agnostic
        if db_dialect == "sqlite":
            # SQLite extract works differently
            years_stmt = (
                select(func.strftime("%Y", ExchangeRateHistory.timestamp).label("year"))
                .distinct()
                .order_by("year")
            )
        else:  # PostgreSQL
            years_stmt = (
                select(
                    func.extract("year", ExchangeRateHistory.timestamp).label("year")
                )
                .distinct()
                .order_by("year")
            )

        if currency:
            years_stmt = years_stmt.where(
                ExchangeRateHistory.currency == currency.upper()
            )
        years_result = await db.execute(years_stmt)

        if db_dialect == "sqlite":
            years = [int(row.year) for row in years_result if row.year is not None]
        else:
            years = [int(row.year) for row in years_result if row.year is not None]

        return {"daily": daily_data, "daily_breakdown": daily_breakdown, "monthly": monthly_data, "years": years}


@router.get("/market-data/stats-granular")
async def get_market_data_stats_granular(
    start_date: datetime.datetime = Query(...),
    end_date: datetime.datetime = Query(...),
    currency: Optional[str] = Query(None),
    user_id: int = Depends(get_current_user_id)
):
    """
    Get detailed hourly density statistics for a specific time range.
    Used for zooming in on charts.
    """
    async with SessionLocal() as db:
        db_dialect = db.bind.dialect.name
        
        # Group by Hour
        if db_dialect == "sqlite":
            time_col = func.strftime("%Y-%m-%d %H:00:00", ExchangeRateHistory.timestamp).label("time_bucket")
        else:
            # Postgres: date_trunc('hour', timestamp)
            time_col = func.to_char(func.date_trunc('hour', ExchangeRateHistory.timestamp), "YYYY-MM-DD HH24:00:00").label("time_bucket")

        stmt = select(
            time_col,
            ExchangeRateHistory.currency,
            func.count(ExchangeRateHistory.id).label("count")
        ).where(
            and_(
                ExchangeRateHistory.timestamp >= start_date,
                ExchangeRateHistory.timestamp <= end_date
            )
        )

        if currency:
            stmt = stmt.where(ExchangeRateHistory.currency == currency.upper())

        stmt = stmt.group_by(time_col, ExchangeRateHistory.currency)
        
        result = await db.execute(stmt)
        
        # Result: { "2023-01-01 10:00:00": { "USD": 5, "EUR": 5 } }
        granular_data = {}
        for row in result:
            t_str = str(row.time_bucket)
            if t_str not in granular_data:
                granular_data[t_str] = {}
            granular_data[t_str][row.currency] = row.count
            
        return granular_data


@router.delete("/market-data/{id}")
async def delete_market_data_point(
    id: int, user_id: int = Depends(get_current_user_id)
):
    """
    Manually delete a historical exchange rate point (outlier cleanup).
    """

    async with SessionLocal() as db:
        stmt = select(ExchangeRateHistory).where(ExchangeRateHistory.id == id)
        result = await db.execute(stmt)
        entry = result.scalars().first()

        if not entry:
            raise HTTPException(status_code=404, detail="Data point not found")

        await db.delete(entry)
        await db.commit()
        return {"message": "Data point deleted successfully"}


@router.patch("/market-data/{id}", response_model=schemas.MarketDataHistory)
async def update_market_data_point(
    id: int,
    update: schemas.MarketDataUpdate,
    user_id: int = Depends(get_current_user_id),
):
    """
    Manually update a historical exchange rate point.
    """

    async with SessionLocal() as db:
        stmt = select(ExchangeRateHistory).where(ExchangeRateHistory.id == id)
        result = await db.execute(stmt)
        entry = result.scalars().first()

        if not entry:
            raise HTTPException(status_code=404, detail="Data point not found")

        entry.rate = update.rate
        await db.commit()
        await db.refresh(entry)
        return entry


# --- System Settings Endpoints ---


@router.get("/settings", response_model=List[schemas.SystemSetting])
async def list_system_settings(
    db: AsyncSession = Depends(get_db), admin: User = Depends(get_current_admin)
):
    """
    List all system-wide settings (Admin only).
    """
    result = await db.execute(select(SystemSetting))
    return result.scalars().all()


@router.get("/config/{key}", response_model=schemas.SystemSetting)
async def get_system_setting(
    key: str,
    db: AsyncSession = Depends(get_db),
    # Optional user_id to allow public access to some keys
    user_id: Optional[int] = Depends(get_optional_user_id),
):
    """
    Get a specific system setting by key.
    """
    result = await db.execute(select(SystemSetting).where(SystemSetting.key == key))
    setting = result.scalars().first()

    if not setting:
        # Return default if not found
        if key == "auth_providers":
            return {
                "key": key,
                "value": {
                    "google": False,
                    "facebook": False,
                    "linkedin": False,
                    "apple": False,
                    "passkey": False,
                },
            }
        raise HTTPException(status_code=404, detail="Setting not found")

    return setting


class SystemSettingUpdate(BaseModel):
    value: Any


@router.put("/settings/{key}", response_model=schemas.SystemSetting)
async def update_system_setting(
    key: str,
    update_data: SystemSettingUpdate,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_current_admin),
):
    """
    Create or update a system-wide setting (Admin only).
    """
    result = await db.execute(select(SystemSetting).where(SystemSetting.key == key))
    setting = result.scalars().first()

    if setting:
        setting.value = update_data.value
    else:
        setting = SystemSetting(key=key, value=update_data.value)
        db.add(setting)

    await db.commit()
    await db.refresh(setting)
    return setting
