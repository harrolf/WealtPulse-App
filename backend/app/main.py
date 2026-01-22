from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.exceptions import RequestValidationError, HTTPException
from starlette.exceptions import HTTPException as StarletteHTTPException
from starlette_csrf import CSRFMiddleware
from sqlalchemy.exc import SQLAlchemyError
from .core.rate_limit import limiter
from .api.api import api_router
from .scheduler import start_scheduler, shutdown_scheduler
from .core.exception_handlers import (
    http_exception_handler,
    validation_exception_handler,
    database_exception_handler,
    general_exception_handler
)
# ... imports ...

# ... (rest of imports)

# ... (app init)


from contextlib import asynccontextmanager
from .core.config import settings
from .database import engine, SessionLocal
from .services.monitoring import get_monitor
from .services.market import get_market_data
from .agents.registry import get_agent_registry
from sqlalchemy import select
import asyncio
from app.utils.datetime_utils import utc_now

from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from prometheus_fastapi_instrumentator import Instrumentator

from .core.logging import setup_logging


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    setup_logging()
    monitor = get_monitor()
    await monitor.start_monitoring() # Start DB persistence
    monitor.log_event("INFO", "Application starting up...", "System")
    start_scheduler()

    # Initialize Agents
    await get_agent_registry().initialize()  # This will register all agents in code and DB

    # Warmup Market Data in background
    async def warmup():
        monitor.log_event("INFO", "Starting Market Data Warmup...", "Startup")
        try:
            await get_market_data().get_rates(["EUR", "USD", "CHF", "BTC"])
            monitor.log_event("SUCCESS", "Market Data Warmup complete", "Startup")
            monitor.update_component_status(
                "Market Data", "Online", {"details": "Warmup successful"}
            )
        except Exception as e:
            monitor.log_event("ERROR", f"Startup fetch failed: {e}", "Startup")
            monitor.update_component_status(
                "Market Data", "Degraded", {"error": str(e)}
            )

    asyncio.create_task(warmup())

    yield
    # Shutdown
    monitor.log_event("INFO", "Application shutting down gracefully...", "System")
    shutdown_scheduler()
    await monitor.stop_monitoring() # Flush logs

    # Close Database Engine properly
    await engine.dispose()
    monitor.log_event("INFO", "Database engine disposed.", "System")
    monitor.log_event("INFO", "Shutdown complete.", "System")


APP_VERSION = settings.APP_VERSION

app = FastAPI(
    title=settings.APP_NAME,
    description="Personal Wealth Management Tool API",
    version=APP_VERSION,
    lifespan=lifespan,
)

app.state.limiter = limiter

# Register exception handlers
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)  # type: ignore
app.add_exception_handler(HTTPException, http_exception_handler)  # type: ignore
app.add_exception_handler(StarletteHTTPException, http_exception_handler)  # type: ignore
app.add_exception_handler(RequestValidationError, validation_exception_handler)  # type: ignore
app.add_exception_handler(SQLAlchemyError, database_exception_handler)  # type: ignore
app.add_exception_handler(Exception, general_exception_handler)  # type: ignore

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.BACKEND_CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.add_middleware(GZipMiddleware, minimum_size=1000)

# from starlette_csrf import CSRFMiddleware (Moved to top)
if settings.ENVIRONMENT == "production":
    app.add_middleware(
        CSRFMiddleware,
        secret=settings.SECRET_KEY,
        cookie_name=settings.CSRF_COOKIE_NAME,
        cookie_path=settings.CSRF_COOKIE_PATH,
        cookie_samesite=settings.CSRF_COOKIE_SAMESITE,
        cookie_httponly=settings.CSRF_COOKIE_HTTPONLY,
        cookie_secure=True,
    )

Instrumentator().instrument(app).expose(app)

app.include_router(api_router, prefix="/api/v1")


@app.get("/")
async def root():
    return {"message": "WealthPulse API", "version": APP_VERSION, "docs": "/docs"}


@app.get("/health")
async def health_check():
    """
    Comprehensive health check verifying DB and critical component status.
    """
    monitor = get_monitor()
    health_status = "ok"
    details = {}

    # 1. Check Database
    try:
        async with SessionLocal() as db:
            await db.execute(select(1))
        details["database"] = "Online"
    except Exception as e:
        health_status = "error"
        details["database"] = f"Offline: {str(e)}"

    # 2. Check Market Data status from Monitor
    market_data_status = monitor._components_status.get("Market Data", {}).get(
        "status", "Unknown"
    )
    details["market_data"] = market_data_status
    if market_data_status == "Offline":
        health_status = "degraded"

    if health_status != "ok":
        # Log health failure to stdout
        monitor.log_event(
            "ERROR", f"Health Check Failed: {health_status}", "Health", details=details
        )

    return {
        "status": health_status,
        "version": APP_VERSION,
        "details": details,
        "timestamp": utc_now().isoformat(),
    }
@app.get("/api/v1/health")
async def health_check_api():
    """
    Alias for the main health check endpoint, served under /api/v1.
    """
    return await health_check()
