import asyncio
import os
import sys

# Add the parent directory to sys.path so we can import 'app'
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))


from app.database import SessionLocal  # noqa: E402
# from app.models import User, Asset  # noqa: E402
from app.api.endpoints.portfolio import (  # noqa: E402
    get_portfolio_summary,
    get_portfolio_history,
    get_portfolio_allocation,
    get_performance_summary,
)
from app.schemas.common import (  # noqa: E402
    PortfolioSummaryResponse,
    HistoryResponse,
    AllocationResponse,
    PerformanceSummaryResponse,
)


async def reverify():
    async with SessionLocal() as db:
        user_id = 3  # Assuming user 3 exists and has data
        
        # Helper to convert dict to schema if needed
        def to_schema(data, schema_cls):
            if isinstance(data, dict):
                return schema_cls(**data)
            return data

        print("--- Testing /summary ---")
        summary_raw = await get_portfolio_summary(db=db, user_id=user_id)
        summary = to_schema(summary_raw, PortfolioSummaryResponse)
        print(f"Summary Response Type: {type(summary)}")
        if isinstance(summary, PortfolioSummaryResponse):
            print(f"Total Value: {summary.total_value} {summary.main_currency}")
            print(f"Asset Count: {len(summary.assets) if summary.assets else 0}")
        else:
            print(f"Summary: {summary}")

        print("\n--- Testing /history ---")
        history_raw = await get_portfolio_history(time_range="30d", db=db, user_id=user_id)
        history = to_schema(history_raw, HistoryResponse)
        print(f"History Response Type: {type(history)}")
        if isinstance(history, HistoryResponse):
            print(f"History Points: {len(history.history)}")
            if history.history:
                print(f"First Point: {history.history[0]}")
        else:
            print(f"History: {history}")

        print("\n--- Testing /allocation ---")
        allocation_raw = await get_portfolio_allocation(db=db, user_id=user_id)
        allocation = to_schema(allocation_raw, AllocationResponse)
        print(f"Allocation Response Type: {type(allocation)}")
        if isinstance(allocation, AllocationResponse):
            print(f"Categories: {[c.name for c in allocation.by_category]}")
        else:
            print(f"Allocation: {allocation}")

        print("\n--- Testing /performance/summary ---")
        perf_raw = await get_performance_summary(db=db, user_id=user_id)
        perf = to_schema(perf_raw, PerformanceSummaryResponse)
        print(f"Performance Response Type: {type(perf)}")
        if isinstance(perf, PerformanceSummaryResponse):
            print(f"Performance: {perf.performance_percent}%")
            print(f"Breakdown Count: {len(perf.breakdown)}")
        else:
            print(f"Performance: {perf}")


if __name__ == "__main__":
    asyncio.run(reverify())
