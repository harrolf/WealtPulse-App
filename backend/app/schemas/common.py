from pydantic import BaseModel, EmailStr, ConfigDict, field_validator
from typing import List, Optional, Any, Dict
from datetime import datetime
from enum import Enum
from decimal import Decimal
from app.core.config import settings


# Enums (mirroring models.py for validation)
class CustodianType(str, Enum):
    BROKER = "Broker"
    BANK = "Bank"
    EXCHANGE = "Exchange"
    SELF_CUSTODY = "Self-custody"
    PHYSICAL = "Physical"


class AssetCategory(str, Enum):
    FINANCIAL = "Financial"
    REAL = "Real"
    ALTERNATIVE = "Alternative"
    LIABILITY = "Liability"


class TransactionType(str, Enum):
    BUY = "Buy"
    SELL = "Sell"
    TRANSFER_BETWEEN = "Transfer between custodians"
    TRANSFER_IN = "Transfer in"
    TRANSFER_OUT = "Transfer out"
    VALUE_ADJUSTMENT = "Value adjustment"
    DIVIDEND = "Dividend/Interest"
    SPLIT = "Split/Fork"


# Base Schemas


class CustodianBase(BaseModel):
    name: str
    type: CustodianType
    dividend_default: str = "Reinvest"
    website_url: Optional[str] = None
    notes: Optional[str] = None


class CustodianCreate(CustodianBase):
    pass


class CustodianUpdate(BaseModel):
    name: Optional[str] = None
    type: Optional[CustodianType] = None
    dividend_default: Optional[str] = None
    website_url: Optional[str] = None
    notes: Optional[str] = None


class Custodian(CustodianBase):
    id: int
    user_id: int

    model_config = ConfigDict(from_attributes=True)


class AssetTypeBase(BaseModel):
    name: str
    category: Optional[str] = None # Deprecated
    category_id: Optional[int] = None
    icon: Optional[str] = None
    fields: List[Dict[str, Any]] = []
    display_config: Dict[str, Any] = {}
    is_liability: bool = False
    is_default: bool = False
    supports_pricing: bool = True


class AssetTypeCreate(AssetTypeBase):
    pass


class AssetTypeUpdate(BaseModel):
    name: Optional[str] = None
    category: Optional[str] = None # Deprecated
    category_id: Optional[int] = None
    icon: Optional[str] = None
    fields: Optional[List[Dict[str, Any]]] = None
    display_config: Optional[Dict[str, Any]] = None
    is_liability: Optional[bool] = None
    is_default: Optional[bool] = None
    supports_pricing: Optional[bool] = None


class AssetType(AssetTypeBase):
    id: int
    user_id: Optional[int] = None

    class Config:
        from_attributes = True


class AssetTypeCategoryBase(BaseModel):
    name: str
    description: Optional[str] = None
    is_system: bool = False
    display_config: Dict[str, Any] = {}


class AssetTypeCategoryCreate(AssetTypeCategoryBase):
    pass


class AssetTypeCategoryUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    is_system: Optional[bool] = None
    display_config: Optional[Dict[str, Any]] = None


class AssetTypeCategory(AssetTypeCategoryBase):
    id: int

    model_config = ConfigDict(from_attributes=True)


class PrimaryGroupBase(BaseModel):
    name: str
    color: str
    icon: Optional[str] = None
    description: Optional[str] = None


class PrimaryGroupCreate(PrimaryGroupBase):
    pass


class PrimaryGroupUpdate(BaseModel):
    name: Optional[str] = None
    color: Optional[str] = None
    icon: Optional[str] = None
    description: Optional[str] = None


class PrimaryGroup(PrimaryGroupBase):
    id: int
    user_id: int

    model_config = ConfigDict(from_attributes=True)


class TagBase(BaseModel):
    name: str
    color: str
    description: Optional[str] = None


class TagCreate(TagBase):
    pass


class TagUpdate(BaseModel):
    name: Optional[str] = None
    color: Optional[str] = None
    description: Optional[str] = None


class Tag(TagBase):
    id: int
    user_id: int

    model_config = ConfigDict(from_attributes=True)


class AssetBase(BaseModel):
    name: str
    ticker_symbol: Optional[str] = None
    purchase_date: Optional[datetime] = None
    purchase_price: Optional[Decimal] = None
    currency: str = "USD"
    notes: Optional[str] = None
    is_favorite: bool = False
    custom_fields: Dict[str, Any] = {}
    current_price: Optional[float] = None

    custodian_id: int
    asset_type_id: int
    group_id: Optional[int] = None


class AssetCreate(AssetBase):
    quantity: Decimal = Decimal("0.0")  # Initial quantity
    tag_ids: List[int] = []


class AssetUpdate(BaseModel):
    name: Optional[str] = None
    ticker_symbol: Optional[str] = None
    purchase_date: Optional[datetime] = None
    purchase_price: Optional[Decimal] = None
    currency: Optional[str] = None
    notes: Optional[str] = None
    is_favorite: Optional[bool] = None
    group_id: Optional[int] = None
    custom_fields: Optional[Dict[str, Any]] = None
    custodian_id: Optional[int] = None
    asset_type_id: Optional[int] = None
    tag_ids: Optional[List[int]] = None
    quantity: Optional[Decimal] = None

    @field_validator("quantity", "purchase_price")
    @classmethod
    def round_decimals(cls, v: Optional[Decimal]) -> Optional[Decimal]:
        if v is not None:
            precision = f"1.{'0' * settings.DECIMAL_PRECISION}"
            return v.quantize(Decimal(precision))
        return v


class Asset(AssetBase):
    id: int
    user_id: int
    quantity: Decimal
    created_at: datetime
    updated_at: datetime

    # Relationships
    custodian: Optional[Custodian] = None
    asset_type: Optional[AssetType] = None
    group: Optional[PrimaryGroup] = None
    tags: List[Tag] = []

    # Computed
    value_in_main_currency: Optional[float] = None

    model_config = ConfigDict(from_attributes=True)


class PriceHistoryBase(BaseModel):
    date: datetime
    price: float
    currency: str = "USD"
    source: Optional[str] = "Manual"


class PriceHistoryCreate(PriceHistoryBase):
    asset_id: int


class PriceHistoryUpdate(BaseModel):
    date: Optional[datetime] = None
    price: Optional[float] = None
    currency: Optional[str] = None
    source: Optional[str] = None


class PriceHistory(PriceHistoryBase):
    id: int
    asset_id: int

    model_config = ConfigDict(from_attributes=True)


class MarketDataHistory(BaseModel):
    id: int
    currency: str
    timestamp: datetime
    rate: Optional[float]

    model_config = ConfigDict(from_attributes=True)


class MarketDataUpdate(BaseModel):
    rate: float


class MarketDataList(BaseModel):
    items: List[MarketDataHistory]
    total: int


class TransactionBase(BaseModel):
    type: TransactionType
    date: datetime
    quantity_change: Decimal
    price_per_unit: Decimal
    fees: Decimal = Decimal("0.0")
    notes: Optional[str] = None
    dest_custodian_id: Optional[int] = None


class TransactionCreate(TransactionBase):
    asset_id: int


class Transaction(TransactionBase):
    id: int
    asset_id: int
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class UserBase(BaseModel):
    email: EmailStr
    name: str


class UserCreate(UserBase):
    pass


class User(UserBase):
    id: int
    created_at: datetime
    settings: Dict[str, Any] = {}

    model_config = ConfigDict(from_attributes=True)


# Portfolio Response Schemas
class AssetSummaryItem(BaseModel):
    id: int
    name: str
    asset_type: str
    category: str
    quantity: float
    value: float
    currency: str
    asset_currency: str
    custodian: Optional[str] = None
    primary_group: Optional[str] = None
    tags: List[str] = []


class PortfolioSummaryResponse(BaseModel):
    total_assets: int
    total_value: float
    main_currency: str
    currencies: Dict[str, float]
    is_historical: bool
    date: str
    assets: Optional[List[AssetSummaryItem]] = None


class HistoryPoint(BaseModel):
    date: str
    value: float


class HistoryResponse(BaseModel):
    history: List[HistoryPoint]
    main_currency: str


class AllocationItem(BaseModel):
    name: str
    value: float


class AllocationResponse(BaseModel):
    by_category: List[AllocationItem]
    by_asset_type: List[AllocationItem]
    by_currency: List[AllocationItem]
    by_custodian: List[AllocationItem]
    by_group: List[AllocationItem]
    by_tag: List[AllocationItem]


class PerformanceBreakdownItem(BaseModel):
    name: str
    value: float
    change_value: float
    performance_percent: float


class PerformanceSummaryResponse(BaseModel):
    period: str
    start_value: float
    end_value: float
    change_value: float
    performance_percent: float
    breakdown: List[PerformanceBreakdownItem]


class TWRSeriesPoint(BaseModel):
    date: str
    value: Decimal
    portfolio_value: Decimal
    daily_return: Decimal
    net_invested_cumulative: Decimal


class PerformanceAdvancedResponse(BaseModel):
    twr_series: List[TWRSeriesPoint]
    mwr_annualized: Decimal
    net_invested: Decimal
    start_value: Decimal
    end_value: Decimal
class SystemSetting(BaseModel):
    key: str
    value: Any

    model_config = ConfigDict(from_attributes=True)
