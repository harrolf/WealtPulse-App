from fastapi import APIRouter

from .endpoints import (
    custodians,
    asset_types,
    assets,
    system,
    portfolio,
    transactions,
    performance,
    settings,
    market,
    data,
    auth,
    users,
    groups_tags,
    admin_agents,
    admin_asset_types,
    admin_asset_categories,
    integrations,
)

api_router = APIRouter()
api_router.include_router(auth.router, prefix="/auth", tags=["auth"])
api_router.include_router(admin_agents.router, prefix="/admin/agents", tags=["admin-agents"])
api_router.include_router(admin_asset_types.router, prefix="/admin/asset-types", tags=["admin-asset-types"])
api_router.include_router(admin_asset_categories.router, prefix="/admin/asset-categories", tags=["admin-asset-categories"])
api_router.include_router(custodians.router, prefix="/custodians", tags=["custodians"])
api_router.include_router(
    asset_types.router, prefix="/asset-types", tags=["asset-types"]
)
api_router.include_router(assets.router, prefix="/assets", tags=["assets"])
api_router.include_router(system.router, prefix="/system", tags=["system"])
api_router.include_router(portfolio.router, prefix="/portfolio", tags=["portfolio"])
api_router.include_router(
    transactions.router, prefix="/transactions", tags=["transactions"]
)
api_router.include_router(
    performance.router, prefix="/portfolio/performance", tags=["performance"]
)
api_router.include_router(settings.router, prefix="/settings", tags=["settings"])
api_router.include_router(market.router, prefix="/market", tags=["market"])
api_router.include_router(groups_tags.router, tags=["groups-tags"])
api_router.include_router(integrations.router, prefix="/integrations", tags=["integrations"])


api_router.include_router(data.router, prefix="/data", tags=["data"])
api_router.include_router(users.router, prefix="/users", tags=["users"])
# Re-import market inside the file or at top? best to add import at top
