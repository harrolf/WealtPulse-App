import asyncio
import os
import sys
import logging

# Add the parent directory to sys.path so we can import 'app'
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from app.database import SessionLocal, engine  # noqa: E402
from app.models import AssetType, AssetCategory, User  # noqa: E402
from sqlalchemy import select  # noqa: E402

# Setup basic logging for standalone script
logging.basicConfig(
    level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)

DEFAULT_ASSET_TYPES = [
    # ... (same list content)
    # Financial Assets
    {
        "name": "Stocks/Equities",
        "category": AssetCategory.FINANCIAL,
        "icon": "trending-up",
        "is_default": True,
        "fields": [
            {"name": "Sector", "type": "text"},
            {"name": "Dividend Yield", "type": "number", "suffix": "%"},
            {"name": "ISIN", "type": "text"},
        ],
    },
    {
        "name": "ETFs",
        "category": AssetCategory.FINANCIAL,
        "icon": "layers",
        "is_default": True,
        "fields": [
            {"name": "Expense Ratio", "type": "number", "suffix": "%"},
            {"name": "Index Tracked", "type": "text"},
            {"name": "Distribution Frequency", "type": "select", "options": ["Monthly", "Quarterly", "Annually", "Accumulating"]},
        ],
    },
    {
        "name": "Bonds",
        "category": AssetCategory.FINANCIAL,
        "icon": "file-text",
        "is_default": True,
        "fields": [
            {"name": "Maturity Date", "type": "date"},
            {"name": "Coupon Rate", "type": "number", "suffix": "%"},
            {"name": "Coupon Frequency", "type": "select", "options": ["Monthly", "Semi-Annually", "Annually"]},
            {"name": "Rating", "type": "text"},
        ],
    },
    {
        "name": "Mutual Funds",
        "category": AssetCategory.FINANCIAL,
        "icon": "pie-chart",
        "is_default": True,
        "fields": [
            {"name": "Expense Ratio", "type": "number", "suffix": "%"},
            {"name": "Morningstar Rating", "type": "number"},
            {"name": "Fund Manager", "type": "text"},
        ],
    },
    {
        "name": "Crypto",
        "category": AssetCategory.FINANCIAL,
        "icon": "bitcoin",
        "is_default": True,
        "fields": [
            {"name": "Network/Chain", "type": "text"},
            {"name": "Wallet Address", "type": "text"},
            {"name": "Staking APY", "type": "number", "suffix": "%"},
            {"name": "Custody Type", "type": "select", "options": ["Self-Custody", "Exchange", "Cold Storage"]},
        ],
    },
    {
        "name": "Cash/Bank Accounts",
        "category": AssetCategory.FINANCIAL,
        "icon": "dollar-sign",
        "is_default": True,
        "fields": [
            {"name": "Account Number", "type": "text"},
            {"name": "Routing Number", "type": "text"},
            {"name": "APY", "type": "number", "suffix": "%"},
            {"name": "Bank Name", "type": "text"},
        ],
    },
    {
        "name": "Retirement Accounts",
        "category": AssetCategory.FINANCIAL,
        "icon": "briefcase",
        "is_default": True,
        "fields": [
            {"name": "Account Type", "type": "select", "options": ["401k", "IRA", "Roth IRA", "Pension"]},
            {"name": "Employer", "type": "text"},
        ],
    },
    {
        "name": "Exchange",
        "category": AssetCategory.FINANCIAL,
        "icon": "activity",
        "is_default": True,
        "fields": [
            {"name": "Exchange Name", "type": "text"},
            {"name": "Account ID", "type": "text"},
        ],
    },
    # Real Assets
    {
        "name": "Real Estate",
        "category": AssetCategory.REAL,
        "icon": "home",
        "is_default": True,
        "fields": [
            {"name": "Address", "type": "text", "required": True},
            {
                "name": "Property Type",
                "type": "select",
                "options": [
                    "Single Family",
                    "Condo",
                    "Townhouse",
                    "Multi-Family",
                    "Commercial",
                    "Land",
                ],
            },
            {"name": "Year Built", "type": "number"},
            {"name": "Square Footage", "type": "number"},
        ],
    },
    {
        "name": "Vehicles",
        "category": AssetCategory.REAL,
        "icon": "truck",
        "is_default": True,
        "fields": [
            {"name": "Make", "type": "text", "required": True},
            {"name": "Model", "type": "text", "required": True},
            {"name": "Year", "type": "number", "required": True},
            {"name": "VIN", "type": "text"},
            {"name": "License Plate", "type": "text"},
        ],
    },
    {
        "name": "Precious Metals",
        "category": AssetCategory.REAL,
        "icon": "anchor",
        "is_default": True,
        "fields": [
            {"name": "Purity", "type": "text"},
            {"name": "Weight", "type": "text"},
        ],
    },
    {
        "name": "Collectibles/Art",
        "category": AssetCategory.REAL,
        "icon": "image",
        "is_default": True,
        "fields": [
            {"name": "Artist/Maker", "type": "text"},
            {"name": "Year", "type": "number"},
            {"name": "Condition", "type": "text"},
        ],
    },
    {
        "name": "Other Physical Assets",
        "category": AssetCategory.REAL,
        "icon": "box",
        "is_default": True,
    },
    # Alternative Investments
    {
        "name": "Private Equity",
        "category": AssetCategory.ALTERNATIVE,
        "icon": "briefcase",
        "is_default": True,
        "fields": [
            {"name": "Fund Manager", "type": "text"},
            {"name": "Commitment Amount", "type": "number"},
        ],
    },
    {
        "name": "Commodities",
        "category": AssetCategory.ALTERNATIVE,
        "icon": "droplet",
        "is_default": True,
    },
    {
        "name": "Options/Derivatives",
        "category": AssetCategory.ALTERNATIVE,
        "icon": "activity",
        "is_default": True,
        "fields": [
            {"name": "Expiration Date", "type": "date"},
            {"name": "Strike Price", "type": "number"},
        ],
    },
    # Liabilities
    {
        "name": "Mortgages",
        "category": AssetCategory.LIABILITY,
        "icon": "home",
        "is_default": True,
        "is_liability": True,
        "fields": [
            {
                "name": "Interest Rate",
                "type": "number",
                "suffix": "%",
                "required": True,
            },
            {"name": "Loan Term", "type": "number", "suffix": "years"},
            {"name": "Start Date", "type": "date"},
        ],
    },
    {
        "name": "Loans",
        "category": AssetCategory.LIABILITY,
        "icon": "credit-card",
        "is_default": True,
        "is_liability": True,
        "fields": [
            {"name": "Interest Rate", "type": "number", "suffix": "%"},
            {"name": "Lender", "type": "text"},
            {"name": "Due Date", "type": "date"},
        ],
    },
    {
        "name": "Credit Card Debt",
        "category": AssetCategory.LIABILITY,
        "icon": "credit-card",
        "is_default": True,
        "is_liability": True,
        "fields": [
            {"name": "APR", "type": "number", "suffix": "%"},
            {"name": "Credit Limit", "type": "number"},
            {"name": "Statement Day", "type": "number"},
        ],
    },
]


async def seed_data():
    async with SessionLocal() as session:
        # Check if we have a default user
        result = await session.execute(
            select(User).where(User.email == "admin@wealthpulse.com")
        )
        user = result.scalar_one_or_none()

        if not user:
            logger.info("Creating default user...")
            user = User(email="admin@wealthpulse.com", name="Admin")
            session.add(user)
            await session.commit()
            await session.refresh(user)

        # Seed Asset Types
        logger.info("Seeding Asset Types...")
        for asset_data in DEFAULT_ASSET_TYPES:
            stmt = select(AssetType).where(AssetType.name == asset_data["name"])
            result = await session.execute(stmt)
            existing = result.scalar_one_or_none()

            if not existing:
                logger.info(f"Adding {asset_data['name']}...")
                asset_type = AssetType(**asset_data)
                session.add(asset_type)
            else:
                # Update existing definition with new fields
                logger.info(f"Updating {asset_data['name']}...")
                existing.fields = asset_data.get("fields", [])
                existing.icon = asset_data.get("icon")
                existing.category = asset_data.get("category")
                existing.is_liability = asset_data.get("is_liability", False)
                existing.supports_pricing = asset_data.get("supports_pricing", True)

        await session.commit()
        logger.info("Seeding complete.")


async def main():
    await seed_data()
    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(main())
