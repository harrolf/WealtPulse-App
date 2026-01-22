import logging
import datetime
from sqlalchemy import text
from app.database import SessionLocal
from app.utils.datetime_utils import utc_now
from .base import BaseAgent

logger = logging.getLogger(__name__)

class MarketCompactorAgent(BaseAgent):
    _instance = None
    name = "Market Data Compaction"
    description = (
        "Cleans up redundant historical market data. "
        "Supports 4-tier retention: 5min, 15min, 1h, 1d, 1w."
    )
    schedule_type = "interval"
    schedule_value = "3600" # 1 hour
    
    default_config = {
        "retention_5min_days": 3,
        "retention_15min_days": 14,
        "retention_1h_days": 90,
        "retention_1d_days": 365
    }

    @classmethod
    def get_instance(cls):
        if cls._instance is None:
            cls._instance = cls()
        return cls._instance

    async def execute(self, agent_config: dict, **kwargs):
        # Default settings or load from config
        ret_5min = agent_config.get("retention_5min_days", 3)
        ret_15min = agent_config.get("retention_15min_days", 14)
        ret_1h = agent_config.get("retention_1h_days", 90)
        ret_1d = agent_config.get("retention_1d_days", 365)
        
        cutoffs = {
            "15min": utc_now() - datetime.timedelta(days=ret_5min),
            "1h": utc_now() - datetime.timedelta(days=ret_15min),
            "1d": utc_now() - datetime.timedelta(days=ret_1h),
            "1w": utc_now() - datetime.timedelta(days=ret_1d)
        }

        await self.log("INFO", f"Starting compaction. Cutoffs: {({k: v.date().isoformat() for k,v in cutoffs.items()})}")

        results = {}

        async with SessionLocal() as db:
            # Detect database dialect
            dialect = db.bind.dialect.name
            
            # 1. Compact to 15min (for data older than ret_5min)
            if dialect == 'postgresql':
                # PostgreSQL: Use date_trunc and EXTRACT
                query_15min = text("""
                    DELETE FROM exchange_rate_history 
                    WHERE id IN (
                        SELECT id FROM (
                            SELECT id, 
                                   ROW_NUMBER() OVER (
                                       PARTITION BY currency, 
                                                    DATE_TRUNC('hour', timestamp),
                                                    FLOOR(EXTRACT(MINUTE FROM timestamp) / 15)
                                       ORDER BY timestamp ASC
                                   ) as rn
                            FROM exchange_rate_history
                            WHERE timestamp < :cutoff
                        ) t
                        WHERE t.rn > 1
                    )
                """)
            else:  # SQLite
                query_15min = text("""
                    DELETE FROM exchange_rate_history 
                    WHERE id IN (
                        SELECT id FROM (
                            SELECT id, 
                                   ROW_NUMBER() OVER (
                                       PARTITION BY currency, 
                                                    strftime('%Y-%m-%d %H', timestamp),
                                                    CAST(strftime('%M', timestamp) AS INTEGER) / 15
                                       ORDER BY timestamp ASC
                                   ) as rn
                            FROM exchange_rate_history
                            WHERE timestamp < :cutoff
                        ) t
                        WHERE t.rn > 1
                    )
                """)
            res = await db.execute(query_15min, {"cutoff": cutoffs["15min"]})
            results["deleted_15min"] = res.rowcount

            # 2. Compact to 1h (for data older than ret_15min)
            if dialect == 'postgresql':
                query_1h = text("""
                    DELETE FROM exchange_rate_history 
                    WHERE id IN (
                        SELECT id FROM (
                            SELECT id, 
                                   ROW_NUMBER() OVER (
                                       PARTITION BY currency, 
                                                    DATE_TRUNC('hour', timestamp)
                                       ORDER BY timestamp ASC
                                   ) as rn
                            FROM exchange_rate_history
                            WHERE timestamp < :cutoff
                        ) t
                        WHERE t.rn > 1
                    )
                """)
            else:  # SQLite
                query_1h = text("""
                    DELETE FROM exchange_rate_history 
                    WHERE id IN (
                        SELECT id FROM (
                            SELECT id, 
                                   ROW_NUMBER() OVER (
                                       PARTITION BY currency, 
                                                    strftime('%Y-%m-%d %H', timestamp)
                                       ORDER BY timestamp ASC
                                   ) as rn
                            FROM exchange_rate_history
                            WHERE timestamp < :cutoff
                        ) t
                        WHERE t.rn > 1
                    )
                """)
            res = await db.execute(query_1h, {"cutoff": cutoffs["1h"]})
            results["deleted_1h"] = res.rowcount

            # 3. Compact to 1d (for data older than ret_1h)
            if dialect == 'postgresql':
                query_1d = text("""
                    DELETE FROM exchange_rate_history 
                    WHERE id IN (
                        SELECT id FROM (
                            SELECT id, 
                                   ROW_NUMBER() OVER (
                                       PARTITION BY currency, 
                                                    DATE_TRUNC('day', timestamp)
                                       ORDER BY timestamp ASC
                                   ) as rn
                            FROM exchange_rate_history
                            WHERE timestamp < :cutoff
                        ) t
                        WHERE t.rn > 1
                    )
                """)
            else:  # SQLite
                query_1d = text("""
                    DELETE FROM exchange_rate_history 
                    WHERE id IN (
                        SELECT id FROM (
                            SELECT id, 
                                   ROW_NUMBER() OVER (
                                       PARTITION BY currency, 
                                                    date(timestamp)
                                       ORDER BY timestamp ASC
                                   ) as rn
                            FROM exchange_rate_history
                            WHERE timestamp < :cutoff
                        ) t
                        WHERE t.rn > 1
                    )
                """)
            res = await db.execute(query_1d, {"cutoff": cutoffs["1d"]})
            results["deleted_1d"] = res.rowcount

            # 4. Compact to 1w (for data older than ret_1d)
            if dialect == 'postgresql':
                # PostgreSQL: Use date_trunc('week', ...) or EXTRACT(week FROM ...)
                query_1w = text("""
                    DELETE FROM exchange_rate_history 
                    WHERE id IN (
                        SELECT id FROM (
                            SELECT id, 
                                   ROW_NUMBER() OVER (
                                       PARTITION BY currency, 
                                                    DATE_TRUNC('week', timestamp)
                                       ORDER BY timestamp ASC
                                   ) as rn
                            FROM exchange_rate_history
                            WHERE timestamp < :cutoff
                        ) t
                        WHERE t.rn > 1
                    )
                """)
            else:  # SQLite
                query_1w = text("""
                    DELETE FROM exchange_rate_history 
                    WHERE id IN (
                        SELECT id FROM (
                            SELECT id, 
                                   ROW_NUMBER() OVER (
                                       PARTITION BY currency, 
                                                    strftime('%Y-%W', timestamp)
                                       ORDER BY timestamp ASC
                                   ) as rn
                            FROM exchange_rate_history
                            WHERE timestamp < :cutoff
                        ) t
                        WHERE t.rn > 1
                    )
                """)
            res = await db.execute(query_1w, {"cutoff": cutoffs["1w"]})
            results["deleted_1w"] = res.rowcount

            await db.commit()

            msg = ", ".join([f"{k}: {v}" for k, v in results.items()])
            await self.log("SUCCESS", f"Compaction complete. Deleted: {msg}")
            
            meta = results.copy()
            meta["status"] = "Success"
            await self.update_metadata(meta)
