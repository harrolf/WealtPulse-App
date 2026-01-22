"""
Global exception handlers for logging HTTP errors and exceptions to the monitoring system.
"""
from fastapi import Request, status
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError, HTTPException
from starlette.exceptions import HTTPException as StarletteHTTPException
from sqlalchemy.exc import SQLAlchemyError
import logging
import traceback
from typing import Union

from app.services.monitoring import get_monitor

logger = logging.getLogger(__name__)


async def http_exception_handler(request: Request, exc: Union[HTTPException, StarletteHTTPException]) -> JSONResponse:
    """
    Handle HTTP exceptions and log them to the monitoring system.
    """
    monitor = get_monitor()
    
    # Determine log level based on status code
    status_code = exc.status_code
    if status_code >= 500:
        level = "ERROR"
    elif status_code == 401 or status_code == 403:
        level = "WARNING"  # Authentication/authorization failures
    elif status_code >= 400:
        level = "INFO"  # Client errors (bad requests, not found, etc.)
    else:
        level = "INFO"
    
    # Log to monitoring system
    details = {
        "status_code": status_code,
        "path": str(request.url.path),
        "method": request.method,
        "client": request.client.host if request.client else "unknown"
    }
    
    message = f"{request.method} {request.url.path} - {status_code}: {exc.detail}"
    monitor.log_event(level, message, "API", details=details)
    
    # Return standard error response
    return JSONResponse(
        status_code=status_code,
        content={"detail": exc.detail}
    )


async def validation_exception_handler(request: Request, exc: RequestValidationError) -> JSONResponse:
    """
    Handle request validation errors and log them.
    """
    monitor = get_monitor()
    
    details = {
        "path": str(request.url.path),
        "method": request.method,
        "errors": exc.errors(),
        "client": request.client.host if request.client else "unknown"
    }
    
    message = f"Validation error on {request.method} {request.url.path}"
    monitor.log_event("WARNING", message, "API", details=details)
    
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={"detail": exc.errors()}
    )


async def database_exception_handler(request: Request, exc: SQLAlchemyError) -> JSONResponse:
    """
    Handle database errors and log them.
    """
    monitor = get_monitor()
    
    error_msg = str(exc)
    tb = traceback.format_exc()
    
    details = {
        "path": str(request.url.path),
        "method": request.method,
        "error": error_msg,
        "traceback": tb,
        "client": request.client.host if request.client else "unknown"
    }
    
    message = f"Database error on {request.method} {request.url.path}: {error_msg}"
    monitor.log_event("ERROR", message, "Database", details=details)
    
    logger.error(f"Database error: {error_msg}\n{tb}")
    
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={"detail": "Database error occurred"}
    )


async def general_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    """
    Catch-all handler for unhandled exceptions.
    """
    monitor = get_monitor()
    
    error_msg = str(exc)
    tb = traceback.format_exc()
    
    details = {
        "path": str(request.url.path),
        "method": request.method,
        "error": error_msg,
        "traceback": tb,
        "exception_type": type(exc).__name__,
        "client": request.client.host if request.client else "unknown"
    }
    
    message = f"Unhandled exception on {request.method} {request.url.path}: {error_msg}"
    monitor.log_event("ERROR", message, "System", details=details)
    
    logger.error(f"Unhandled exception: {error_msg}\n{tb}")
    
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={"detail": "Internal server error"}
    )
