from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker, declarative_base
from .core.config import settings

# Database URL is already validated/processed in settings
SQLALCHEMY_DATABASE_URL = settings.DATABASE_URL

# Connection pool configuration
is_sqlite = "sqlite" in SQLALCHEMY_DATABASE_URL

if is_sqlite:
    # SQLite: Use NullPool to avoid threading issues in development
    # SQLite doesn't benefit from connection pooling in async context
    from sqlalchemy.pool import NullPool

    engine = create_async_engine(
        SQLALCHEMY_DATABASE_URL,
        connect_args={"check_same_thread": False},
        poolclass=NullPool,
        echo=False,  # Set to True for SQL debugging
    )
else:
    # PostgreSQL/other databases: Use connection pooling for production
    engine = create_async_engine(
        SQLALCHEMY_DATABASE_URL,
        pool_size=20,  # Number of connections to keep open
        max_overflow=40,  # Additional connections under load
        pool_timeout=30,  # Seconds to wait for a connection
        pool_pre_ping=True,  # Verify connections before using
        pool_recycle=3600,  # Recycle connections after 1 hour
        query_cache_size=1200,  # Cache compiled SQL statements
        echo=False,  # Set to True for SQL debugging
    )

SessionLocal = sessionmaker(
    autocommit=False, autoflush=False, bind=engine, class_=AsyncSession
)

Base = declarative_base()


async def get_db():
    async with SessionLocal() as session:
        yield session
