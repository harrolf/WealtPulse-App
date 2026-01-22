"""
Broker/Exchange Import API Endpoints

Generic endpoints for importing transactions from various brokers and exchanges.
Supports auto-detection and manual broker selection.
"""

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Query
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Any, Dict, Optional
import logging

from app.database import get_db
from app.models import User
from app.api.deps import get_current_user
from app.services.broker_import import broker_import_service, BrokerType
from pydantic import BaseModel

router = APIRouter()
logger = logging.getLogger(__name__)


class BrokerImportSummary(BaseModel):
    """Summary of broker import for user review."""
    broker: str
    total_transactions: int
    buys: int
    sells: int
    dividends: int
    deposits: int
    withdrawals: int
    fees: int
    other: int
    unique_assets: int
    asset_tickers: list[str]
    total_deposited: float
    total_withdrawn: float
    total_dividends: float
    total_fees: float
    date_range: Dict[str, str | None]


class BrokerDetectionResponse(BaseModel):
    """Response for broker detection."""
    detected_broker: str
    confidence: str  # high, medium, low
    supported: bool


@router.post("/detect", response_model=BrokerDetectionResponse)
async def detect_broker(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
) -> Any:
    """
    Detect broker/exchange type from uploaded file.
    
    This endpoint only detects the broker type without parsing the full file.
    Useful for showing the user what was detected before proceeding.
    """
    # Validate file type
    if not file.filename:
        raise HTTPException(status_code=400, detail="No filename provided")
    
    allowed_extensions = ('.csv', '.xlsx', '.xls', '.pdf')
    if not file.filename.lower().endswith(allowed_extensions):
        raise HTTPException(
            status_code=400,
            detail=f"Invalid file type. Please upload one of: {', '.join(allowed_extensions)}"
        )
    
    try:
        # Read file content as bytes
        content = await file.read()
        
        # Detect broker
        broker_type = broker_import_service.detect_broker(content, file.filename)
        
        # Determine confidence based on detection method
        confidence = "high" if broker_type != BrokerType.UNKNOWN else "low"
        supported = broker_type in broker_import_service.PARSERS
        
        logger.info(
            f"User {current_user.id} uploaded file '{file.filename}': "
            f"detected as {broker_type.value} (confidence: {confidence})"
        )
        
        return {
            "detected_broker": broker_type.value,
            "confidence": confidence,
            "supported": supported,
        }
        
    except Exception as e:
        logger.error(f"Error detecting broker: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"An error occurred while analyzing the file: {str(e)}"
        )


@router.post("/upload", response_model=BrokerImportSummary)
async def upload_broker_file(
    file: UploadFile = File(...),
    broker: Optional[str] = Query(None, description="Manual broker selection (overrides auto-detection)"),
    skip_closed_positions: bool = Query(True, description="Skip assets with zero balance"),
    simplified_import: bool = Query(False, description="Import only current holdings as a summary"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Any:
    """
    Upload and parse broker/exchange file (CSV, XLSX, or PDF).
    
    Returns a summary of the transactions for user review before import.
    Does NOT create any transactions yet - this is just for preview.
    
    Args:
        file: Transaction file from broker/exchange (CSV, XLSX, or PDF)
        broker: Optional manual broker selection (e.g., 'etoro', 'binance')
                If not provided, will auto-detect from file content
    """
    # Validate file type
    if not file.filename:
        raise HTTPException(status_code=400, detail="No filename provided")
    
    allowed_extensions = ('.csv', '.xlsx', '.xls', '.pdf')
    if not file.filename.lower().endswith(allowed_extensions):
        raise HTTPException(
            status_code=400,
            detail=f"Invalid file type. Please upload one of: {', '.join(allowed_extensions)}"
        )
    
    try:
        # Read file content as bytes
        content = await file.read()
        
        # Parse broker type if provided
        broker_type = None
        if broker:
            try:
                broker_type = BrokerType(broker.lower())
            except ValueError:
                raise HTTPException(
                    status_code=400,
                    detail=f"Unsupported broker: {broker}. Supported: {[b.value for b in BrokerType if b != BrokerType.UNKNOWN]}"
                )
        
        # Parse file (auto-detects if broker_type is None)
        detected_broker, transactions, summary_data = broker_import_service.parse_file(
            content,
            broker_type=broker_type,
            filename=file.filename
        )
        
        if not transactions:
            raise HTTPException(
                status_code=400,
                detail=f"No transactions found in {detected_broker.value} file."
            )
        
        # Apply import rules (filter/transform) for the preview summary
        transactions = broker_import_service._apply_import_rules(
            transactions,
            skip_closed_positions,
            simplified_import
        )

        # Generate summary
        summary = broker_import_service.generate_summary(transactions, detected_broker)
        
        logger.info(
            f"User {current_user.id} uploaded {detected_broker.value} file: "
            f"{summary['total_transactions']} transactions, "
            f"{summary['unique_assets']} unique assets"
        )
        
        return summary
        
    except ValueError as e:
        raise HTTPException(
            status_code=400,
            detail=str(e)
        )
    except Exception as e:
        logger.error(f"Error processing broker file: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"An error occurred while processing the file: {str(e)}"
        )


@router.get("/supported")
async def get_supported_brokers() -> Dict[str, Any]:
    """
    Get list of supported brokers/exchanges.
    
    Returns information about which brokers are supported and their status.
    """
    supported = []
    
    for broker_type in BrokerType:
        if broker_type == BrokerType.UNKNOWN:
            continue
        
        has_parser = broker_type in broker_import_service.PARSERS
        
        supported.append({
            "id": broker_type.value,
            "name": broker_type.value.replace('_', ' ').title(),
            "supported": has_parser,
            "status": "active" if has_parser else "coming_soon"
        })
    
    return {
        "brokers": supported,
        "total": len(supported),
        "active": sum(1 for b in supported if b["supported"])
    }


@router.post("/import")
async def import_broker_transactions(
    file: UploadFile = File(...),
    broker: Optional[str] = Query(None, description="Manual broker selection"),
    skip_closed_positions: bool = Query(True, description="Skip assets with zero balance"),
    simplified_import: bool = Query(False, description="Import only current holdings as a summary"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Any:
    """
    Import broker transactions directly.
    """
    # Validate file type
    if not file.filename:
        raise HTTPException(status_code=400, detail="No filename provided")
    
    allowed_extensions = ('.csv', '.xlsx', '.xls', '.pdf')
    if not file.filename.lower().endswith(allowed_extensions):
        raise HTTPException(
            status_code=400,
            detail=f"Invalid file type. Please upload one of: {', '.join(allowed_extensions)}"
        )
    
    try:
        # Read file content as bytes
        content = await file.read()
        
        # Capture user ID before session commit inside the service
        user_id = current_user.id
        
        # Parse broker type if provided
        broker_type = None
        if broker:
            try:
                broker_type = BrokerType(broker.lower())
            except ValueError:
                raise HTTPException(status_code=400, detail=f"Unsupported broker: {broker}")
        
        # Perform import
        result = await broker_import_service.import_transactions(
            db=db,
            user_id=user_id,
            content=content,
            broker_type=broker_type,
            filename=file.filename,
            skip_closed_positions=skip_closed_positions,
            simplified_import=simplified_import
        )
        
        logger.info(
            f"User {user_id} imported from {result['broker']}: "
            f"{result['imported']} transactions imported, "
            f"{result['assets_created']} assets created"
        )
        
        return result
        
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error importing broker transactions: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"An error occurred during import: {str(e)}"
        )
