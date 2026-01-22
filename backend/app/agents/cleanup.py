import logging
import datetime
from sqlalchemy import text
from app.database import SessionLocal
from app.utils.datetime_utils import utc_now
from .base import BaseAgent

logger = logging.getLogger(__name__)

class SystemCleanupAgent(BaseAgent):
    name = "System Maintenance"
    description = "Cleans up old system logs and agent logs to free up space."
    schedule_type = "interval"
    schedule_value = "86400" # 24 hours (Daily)

    default_config = {
        "log_retention_days": 30
    }

    @classmethod
    def get_instance(cls):
        # Basic singleton pattern for Registry
        if not hasattr(cls, "_instance"):
            cls._instance = cls()
        return cls._instance

    async def execute(self, agent_config: dict, **kwargs):
        retention_days = agent_config.get("log_retention_days", 30)
        
        cutoff = utc_now() - datetime.timedelta(days=retention_days)
        
        await self.log("INFO", f"Starting System Cleanup. Deleting logs older than {cutoff.date()} ({retention_days} days retention)")

        deleted_system_logs = 0
        deleted_agent_logs = 0

        async with SessionLocal() as db:
            # 1. Cleanup System Logs
            # Note: We use raw SQL or SQLAlchemy delete for efficiency
            # Table: system_logs
            q_sys = text("DELETE FROM system_logs WHERE timestamp < :cutoff")
            r_sys = await db.execute(q_sys, {"cutoff": cutoff})
            deleted_system_logs = r_sys.rowcount
            
            # 2. Cleanup Agent Logs
            # Table: agent_logs
            q_agent = text("DELETE FROM agent_logs WHERE timestamp < :cutoff")
            r_agent = await db.execute(q_agent, {"cutoff": cutoff})
            deleted_agent_logs = r_agent.rowcount

            await db.commit()

        await self.log("SUCCESS", f"Cleanup complete. Deleted {deleted_system_logs} system logs and {deleted_agent_logs} agent logs.")
        
        await self.update_metadata({
            "deleted_system_logs": deleted_system_logs,
            "deleted_agent_logs": deleted_agent_logs,
            "last_cutoff": cutoff.isoformat()
        })
