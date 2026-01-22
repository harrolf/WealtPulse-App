from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.interval import IntervalTrigger
import logging


logger = logging.getLogger(__name__)

scheduler = AsyncIOScheduler()


from .agents.registry import get_agent_registry  # noqa: E402


async def update_prices_job():
    """Background job to update asset prices"""
    registry = get_agent_registry()
    agent = registry.get_agent("Asset Price Updater")
    if agent:
        await agent.run()


async def compact_history_job():
    """Market Data Compaction Agent"""
    registry = get_agent_registry()
    agent = registry.get_agent("Market Data Compaction")
    if agent:
        await agent.run()


async def run_system_cleanup():
    """System Maintenance Agent"""
    registry = get_agent_registry()
    agent = registry.get_agent("System Maintenance")
    if agent:
        await agent.run()


def start_scheduler():
    """Start the background scheduler"""

    # Schedule price updates every hour
    scheduler.add_job(
        update_prices_job,
        trigger=IntervalTrigger(hours=1),
        id="update_prices",
        name="Update asset prices",
        replace_existing=True,
    )

    # Schedule compaction - Check every hour, execute based on config
    scheduler.add_job(
        compact_history_job,
        trigger=IntervalTrigger(hours=1),
        id="compact_history",
        name="Market Data Compaction",
        replace_existing=True,
    )

    # Schedule System Maintenance - Daily
    scheduler.add_job(
        run_system_cleanup,
        trigger=IntervalTrigger(hours=24), 
        id="system_cleanup",
        name="System Maintenance",
        replace_existing=True,
    )

    scheduler.start()

    logger.info("Scheduler started - Agents active")


def shutdown_scheduler():
    """Shutdown the scheduler gracefully"""
    if scheduler.running:
        scheduler.shutdown()
        logger.info("Scheduler shut down")
