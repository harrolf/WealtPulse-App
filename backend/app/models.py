from sqlalchemy import (
    Column,
    Integer,
    String,
    Boolean,
    ForeignKey,
    DateTime,
    JSON,
    UniqueConstraint,
    Numeric,
    CheckConstraint,
    Index,
)
from sqlalchemy.orm import relationship
import enum
from .database import Base
from .utils.datetime_utils import utc_now
from sqlalchemy.types import TypeDecorator
from app.core.crypto import get_fernet


# Enums
class CustodianType(str, enum.Enum):
    BROKER = "Broker"
    BANK = "Bank"
    EXCHANGE = "Exchange"
    SELF_CUSTODY = "Self-custody"
    PHYSICAL = "Physical"


class AssetCategory(str, enum.Enum):
    FINANCIAL = "Financial"
    REAL = "Real"
    ALTERNATIVE = "Alternative"
    LIABILITY = "Liability"


class SystemLog(Base):
    __tablename__ = "system_logs"
    
    id = Column(Integer, primary_key=True, index=True)
    level = Column(String, index=True)  # INFO, WARNING, ERROR
    component = Column(String, index=True) # Backend, Frontend, System
    message = Column(String)
    details = Column(JSON, nullable=True)  # Can store stack traces or dicts
    timestamp = Column(DateTime, default=utc_now, index=True)

class TransactionType(str, enum.Enum):
    BUY = "Buy"
    SELL = "Sell"
    TRANSFER_BETWEEN = "Transfer between custodians"
    TRANSFER_IN = "Transfer in"
    TRANSFER_OUT = "Transfer out"
    VALUE_ADJUSTMENT = "Value adjustment"
    DIVIDEND = "Dividend/Interest"
    SPLIT = "Split/Fork"


# Models


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=True)
    name = Column(String)
    is_active = Column(Boolean, default=True)
    is_verified = Column(Boolean, default=False)
    email_verified = Column(Boolean, default=False)
    is_admin = Column(Boolean, default=False)
    created_at = Column(DateTime, default=utc_now)
    updated_at = Column(DateTime, default=utc_now, onupdate=utc_now)
    settings = Column(JSON, default={})

    # Relationships
    oauth_accounts = relationship(
        "OAuthAccount", back_populates="user", cascade="all, delete-orphan"
    )
    webauthn_credentials = relationship(
        "WebAuthnCredential", back_populates="user", cascade="all, delete-orphan"
    )
    refresh_tokens = relationship(
        "RefreshToken", back_populates="user", cascade="all, delete-orphan"
    )

    custodians = relationship("Custodian", back_populates="user")
    asset_types = relationship("AssetType", back_populates="user")  # Custom types
    primary_groups = relationship("PrimaryGroup", back_populates="user")
    tags = relationship("Tag", back_populates="user")
    assets = relationship("Asset", back_populates="user")


class UserShare(Base):
    __tablename__ = "user_shares"

    id = Column(Integer, primary_key=True, index=True)
    owner_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    viewer_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    permission = Column(String, default="read")  # "read", "full"
    created_at = Column(DateTime, default=utc_now)

    user = relationship("User", foreign_keys=[owner_id], backref="shared_by_me")
    viewer = relationship("User", foreign_keys=[viewer_id], backref="shared_with_me")


# ----------------------------------------------------------------------------
# Custom Types (Encryption)
# ----------------------------------------------------------------------------



class EncryptedString(TypeDecorator):
    """Encrypt value on the way in, decrypt on the way out."""

    impl = String
    cache_ok = True

    def process_bind_param(self, value, dialect):
        if not value:
            return value
        try:
            f = get_fernet()
            return f.encrypt(value.encode("utf-8")).decode("utf-8")
        except Exception:
            # If encryption fails (key issue?), better to fail than store plaintext unexpectedly?
            # Or log error? For now, let it raise.
            raise

    def process_result_value(self, value, dialect):
        if not value:
            return value
        try:
            f = get_fernet()
            return f.decrypt(value.encode("utf-8")).decode("utf-8")
        except Exception:
            # Fallback for existing plaintext or key mismatch
            return value


class OAuthAccount(Base):
    __tablename__ = "oauth_accounts"
    __table_args__ = (
        UniqueConstraint("provider", "provider_user_id", name="uq_oauth_provider_id"),
    )

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    provider = Column(String, nullable=False)  # google, apple, linkedin
    provider_user_id = Column(String, nullable=False, index=True)
    access_token = Column(EncryptedString, nullable=False)
    refresh_token = Column(EncryptedString, nullable=True)
    token_expires_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=utc_now)
    updated_at = Column(DateTime, default=utc_now, onupdate=utc_now)

    user = relationship("User", back_populates="oauth_accounts")


class WebAuthnCredential(Base):
    __tablename__ = "webauthn_credentials"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    credential_id = Column(String, unique=True, nullable=False, index=True)
    public_key = Column(String, nullable=False)
    sign_count = Column(Integer, default=0)
    device_name = Column(String, nullable=True)
    created_at = Column(DateTime, default=utc_now)
    last_used_at = Column(DateTime, nullable=True)

    user = relationship("User", back_populates="webauthn_credentials")


class RefreshToken(Base):
    __tablename__ = "refresh_tokens"
    __table_args__ = (
        # Composite index for token lookups and cleanup
        Index("idx_user_expires", "user_id", "expires_at"),
    )

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    token_hash = Column(String, unique=True, nullable=False, index=True)
    expires_at = Column(DateTime, nullable=False)
    revoked = Column(Boolean, default=False)
    created_at = Column(DateTime, default=utc_now)

    user = relationship("User", back_populates="refresh_tokens")


class Custodian(Base):
    __tablename__ = "custodians"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), index=True)
    name = Column(String, index=True)
    type = Column(String)  # Stored as string to allow flexibility, but UI uses Enum
    dividend_default = Column(String, default="Reinvest")  # Reinvest, Cash out, Manual
    website_url = Column(String, nullable=True)
    notes = Column(String, nullable=True)

    user = relationship("User", back_populates="custodians")
    assets = relationship("Asset", back_populates="custodian")


class AssetTypeCategory(Base):
    __tablename__ = "asset_type_categories"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, index=True)
    description = Column(String, nullable=True)
    is_system = Column(Boolean, default=False)
    display_config = Column(JSON, default={})


class AssetType(Base):
    __tablename__ = "asset_types"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(
        Integer, ForeignKey("users.id"), nullable=True, index=True
    )  # Null for system defaults
    name = Column(String, unique=True, index=True)
    category_id = Column(Integer, ForeignKey("asset_type_categories.id"), nullable=True)
    category = Column(String)  # Financial, Real, etc. - DEPRECATED (kept for temporary compatibility)
    icon = Column(String, nullable=True)
    fields = Column(JSON, default=[])  # Custom fields definition
    display_config = Column(JSON, default={})  # Toggles for standard fields (ticker, qty, etc.)
    is_liability = Column(Boolean, default=False)
    is_default = Column(Boolean, default=False)
    supports_pricing = Column(Boolean, default=True)

    user = relationship("User", back_populates="asset_types")
    assets = relationship("Asset", back_populates="asset_type")
    category_ref = relationship("AssetTypeCategory")


class PrimaryGroup(Base):
    __tablename__ = "primary_groups"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), index=True)
    name = Column(String, index=True)
    color = Column(String)
    icon = Column(String, nullable=True)

    user = relationship("User", back_populates="primary_groups")
    assets = relationship("Asset", back_populates="group")
    description = Column(String, nullable=True)


class Tag(Base):
    __tablename__ = "tags"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), index=True)
    name = Column(String, index=True)
    color = Column(String)
    description = Column(String, nullable=True)

    user = relationship("User", back_populates="tags")
    # Many-to-Many relationship with Asset handled by association table below


class AssetTag(Base):
    __tablename__ = "asset_tags"
    asset_id = Column(Integer, ForeignKey("assets.id"), primary_key=True)
    tag_id = Column(Integer, ForeignKey("tags.id"), primary_key=True)


class Asset(Base):
    __tablename__ = "assets"
    __table_args__ = (
        # Composite index for portfolio queries (user + type filtering)
        Index("idx_user_assettype", "user_id", "asset_type_id"),
    )

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    custodian_id = Column(Integer, ForeignKey("custodians.id"))
    asset_type_id = Column(Integer, ForeignKey("asset_types.id"))
    group_id = Column(Integer, ForeignKey("primary_groups.id"), nullable=True)

    name = Column(String, index=True)
    ticker_symbol = Column(String, nullable=True, index=True)
    quantity = Column(Numeric(precision=20, scale=8), default=0.0)

    # Static data for initial purchase reference (actual cost basis calculated via transactions)
    purchase_date = Column(DateTime, nullable=True)
    purchase_price = Column(Numeric(precision=20, scale=8), nullable=True)
    currency = Column(String, default="USD")  # The currency the asset is priced in

    notes = Column(String, nullable=True)
    is_favorite = Column(Boolean, default=False)
    custom_fields = Column(JSON, default={})

    created_at = Column(DateTime, default=utc_now)
    updated_at = Column(DateTime, default=utc_now, onupdate=utc_now)

    user = relationship("User", back_populates="assets")
    custodian = relationship("Custodian", back_populates="assets")
    asset_type = relationship("AssetType", back_populates="assets")
    group = relationship("PrimaryGroup", back_populates="assets")
    transactions = relationship(
        "Transaction", back_populates="asset", cascade="all, delete-orphan"
    )
    price_history = relationship(
        "PriceHistory", back_populates="asset", cascade="all, delete-orphan"
    )
    tags = relationship("Tag", secondary="asset_tags", backref="assets")


class Transaction(Base):
    __tablename__ = "transactions"
    __table_args__ = (
        CheckConstraint("price_per_unit >= 0", name="check_positive_price"),
        CheckConstraint("fees >= 0", name="check_positive_fees"),
        Index("idx_asset_date", "asset_id", "date"),
        Index("idx_date_type", "date", "type"),
    )

    id = Column(Integer, primary_key=True, index=True)
    asset_id = Column(Integer, ForeignKey("assets.id"))

    type = Column(String)  # Buy, Sell, etc.
    date = Column(DateTime, index=True)
    quantity_change = Column(Numeric(precision=20, scale=8))  # Positive or negative
    price_per_unit = Column(Numeric(precision=20, scale=8))
    fees = Column(Numeric(precision=20, scale=8), default=0.0)
    notes = Column(String, nullable=True)

    # For transfers
    dest_custodian_id = Column(Integer, ForeignKey("custodians.id"), nullable=True)

    created_at = Column(DateTime, default=utc_now)

    asset = relationship("Asset", back_populates="transactions")
    dest_custodian = relationship("Custodian", foreign_keys=[dest_custodian_id])


class PriceHistory(Base):
    __tablename__ = "price_history"
    __table_args__ = (Index("idx_asset_date_source", "asset_id", "date", "source"),)

    id = Column(Integer, primary_key=True, index=True)
    asset_id = Column(Integer, ForeignKey("assets.id"))

    date = Column(DateTime, index=True)
    price = Column(Numeric(precision=20, scale=8))
    currency = Column(String)
    source = Column(String, nullable=True)  # e.g., "Yahoo", "Manual"

    asset = relationship("Asset", back_populates="price_history")


class ExchangeRateHistory(Base):
    __tablename__ = "exchange_rate_history"
    __table_args__ = (
        UniqueConstraint("currency", "timestamp", name="uq_currency_timestamp"),
        Index("idx_currency_timestamp", "currency", "timestamp"),
    )

    id = Column(Integer, primary_key=True, index=True)
    currency = Column(String, index=True)
    rate = Column(Numeric(precision=20, scale=8))
    timestamp = Column(DateTime, default=utc_now, index=True)
class SystemSetting(Base):
    __tablename__ = "system_settings"

    id = Column(Integer, primary_key=True, index=True)
    key = Column(String, unique=True, index=True, nullable=False)
    value = Column(JSON, nullable=False)
    updated_at = Column(DateTime, default=utc_now, onupdate=utc_now)


class SystemAgent(Base):
    __tablename__ = "system_agents"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, index=True, nullable=False)
    description = Column(String, nullable=True)
    status = Column(String, default="idle")  # idle, running, failed, waiting
    is_enabled = Column(Boolean, default=True)
    
    last_run_at = Column(DateTime, nullable=True)
    next_run_at = Column(DateTime, nullable=True)
    last_duration_ms = Column(Integer, nullable=True)
    last_error = Column(String, nullable=True)
    
    schedule_type = Column(String, default="interval")  # cron, interval, manual
    schedule_value = Column(String, nullable=True)  # e.g., "3600" or "0 0 * * *"
    
    config = Column(JSON, default={})
    agent_metadata = Column(JSON, default={})
    
    created_at = Column(DateTime, default=utc_now)
    updated_at = Column(DateTime, default=utc_now, onupdate=utc_now)


class AgentLog(Base):
    __tablename__ = "agent_logs"

    id = Column(Integer, primary_key=True, index=True)
    agent_id = Column(Integer, ForeignKey("system_agents.id"), nullable=False)
    
    level = Column(String, index=True)  # INFO, WARNING, ERROR, SUCCESS
    message = Column(String, nullable=False)
    details = Column(JSON, nullable=True)
    timestamp = Column(DateTime, default=utc_now, index=True)

    agent = relationship("SystemAgent", backref="logs")
