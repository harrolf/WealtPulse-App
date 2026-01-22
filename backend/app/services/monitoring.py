import logging
import asyncio
import datetime
from typing import List, Dict, Any, Optional
from app.utils.datetime_utils import utc_now
import threading
from collections import deque
from app.models import SystemLog, SystemSetting, AgentLog, SystemAgent
from app.database import SessionLocal
from sqlalchemy import select

logger = logging.getLogger(__name__)

class MonitoredLoggingHandler(logging.Handler):
    """
    Redirects all standard Python logs to the SystemMonitor.
    """
    def emit(self, record):
        try:
            monitor = SystemMonitor.get_instance()
            # Avoid recursion if monitor logs something itself
            if record.name == "app.services.monitoring":
                return
            
            level_map = {
                logging.DEBUG: "DEBUG",
                logging.INFO: "INFO",
                logging.WARNING: "WARNING",
                logging.ERROR: "ERROR",
                logging.CRITICAL: "CRITICAL"
            }
            
            level = level_map.get(record.levelno, "INFO")
            msg = self.format(record)
            
            # Call the internal log method without re-triggering stdout logging
            monitor._internal_log(level, msg, component=record.name)
        except Exception:
            pass

class SystemMonitor:
    _instance = None
    _lock = threading.RLock()
    
    # Priority values for filtering
    LEVEL_PRIORITY = {
        "DEBUG": 0,
        "INFO": 1,
        "SUCCESS": 2,
        "WARNING": 3,
        "ERROR": 4,
        "CRITICAL": 5
    }

    def __init__(self):
        # Ring buffer for logs (keep last 100 in RAM for immediate view if DB fails)
        self._logs = deque(maxlen=100)
        self._components_status: Dict[str, Dict[str, Any]] = {}

        # Async Persistence
        self._log_queue = asyncio.Queue()
        self._stop_event = asyncio.Event()
        self._worker_task = None
        self._retention_level = "INFO" # Default, will attempt to load from DB

        # Initial log
        self.log_event("INFO", "System Monitor initialized", "System")

    @classmethod
    def get_instance(cls):
        if cls._instance is None:
            with cls._lock:
                if cls._instance is None:
                    cls._instance = cls()
        return cls._instance

    async def start_monitoring(self):
        """Start background tasks for monitoring and persistence."""
        if not self._worker_task:
            self._stop_event.clear()
            self._worker_task = asyncio.create_task(self._persistence_worker())
            # Load retention preference
            await self._load_retention_level()

    async def stop_monitoring(self):
        """Stop background tasks."""
        if self._worker_task:
            self._stop_event.set()
            # Push a sentinel to unblock queue
            await self._log_queue.put(None)
            await self._worker_task
            self._worker_task = None

    async def _load_retention_level(self):
        try:
            async with SessionLocal() as db:
                result = await db.execute(select(SystemSetting).where(SystemSetting.key == "system_logging_level"))
                setting = result.scalars().first()
                if setting:
                    self._retention_level = setting.value
        except Exception:
            pass # Use default

    def _should_log(self, level: str) -> bool:
        thresh = self.LEVEL_PRIORITY.get(self._retention_level.upper(), 1)
        curr = self.LEVEL_PRIORITY.get(level.upper(), 1)
        return curr >= thresh

    async def _persistence_worker(self):
        """Background worker to save logs to DB."""
        batch = []
        while not self._stop_event.is_set():
            try:
                # Wait for next log or timeout to flush batch
                try:
                    entry = await asyncio.wait_for(self._log_queue.get(), timeout=2.0)
                    if entry is None: # Sentinel
                        break
                    batch.append(entry)
                except asyncio.TimeoutError:
                    pass # Flush batch
                
                if batch:
                    await self._flush_batch(batch)
                    batch = []
                    
            except Exception as e:
                logger.error(f"Error in log persistence worker: {e}")
                await asyncio.sleep(1)

        # Final flush
        if batch:
            await self._flush_batch(batch)

    async def _flush_batch(self, batch: List[Dict]):
        try:
            async with SessionLocal() as db:
                for log_data in batch:
                    # Filter based on current retention level again? 
                    # Prefer filtering at ingestion, but double check safe.
                    db_log = SystemLog(
                        level=log_data["level"],
                        component=log_data["component"],
                        message=log_data["message"],
                        details=log_data["details"],
                        timestamp=log_data["timestamp_dt"] 
                    )
                    db.add(db_log)
                await db.commit()
        except Exception as e:
            logger.error(f"Failed to flush logs to DB: {e}")

    def log_event(
        self,
        level: str,
        message: str,
        component: str = "Backend",
        details: Optional[Any] = None,
    ):
        """
        Log a system event.
        Level: INFO, WARNING, ERROR, SUCCESS
        """
        # 1. Stdout (Traditional Logging)
        log_msg = message
        if details:
            log_msg += f" | Details: {str(details)}"

        log_level = logging.INFO
        if level == "ERROR":
            log_level = logging.ERROR
        elif level == "WARNING":
            log_level = logging.WARNING
        
        logging.getLogger(component).log(log_level, log_msg)
        
        # 2. Internal logic follows in _internal_log (called by Handler)

    def _internal_log(
        self,
        level: str,
        message: str,
        component: str = "Backend",
        details: Optional[Any] = None,
    ):
        """Internal logging implementation that doesn't trigger standard logging recursion."""
        ts_dt = utc_now()
        ts_str = ts_dt.isoformat()
        
        entry = {
            "timestamp": ts_str,
            "timestamp_dt": ts_dt, # For DB
            "level": level,
            "message": message,
            "component": component,
            "details": details,
        }

        # RAM Buffer (always keep recent for safety)
        with self._lock:
            self._logs.appendleft(entry)

        # Queue for DB
        if self._should_log(level):
            try:
                loop = asyncio.get_running_loop()
                loop.call_soon_threadsafe(self._log_queue.put_nowait, entry)
            except RuntimeError:
                pass
            except Exception:
                pass


    def update_component_status(
        self, name: str, status: str, details: Dict[str, Any] = None
    ):
        """
        Update health status of a component.
        Status: Online, Offline, Degraded
        """
        with self._lock:
            self._components_status[name] = {
                "status": status,
                "last_updated": utc_now().isoformat(),
                "details": details or {},
            }

    async def get_logs_from_db(self, limit: int = 100) -> List[Dict[str, Any]]:
        """Fetch logs from DB (System + Agents) merged."""
        try:
            async with SessionLocal() as db:
                # 1. Fetch System Logs
                sys_result = await db.execute(
                    select(SystemLog)
                    .order_by(SystemLog.timestamp.desc())
                    .limit(limit)
                )
                sys_logs = sys_result.scalars().all()

                # 2. Fetch Agent Logs
                agent_result = await db.execute(
                    select(AgentLog, SystemAgent.name)
                    .join(SystemAgent, AgentLog.agent_id == SystemAgent.id)
                    .order_by(AgentLog.timestamp.desc())
                    .limit(limit)
                )
                # sqlalchemy async result for joins returns Row objects
                agent_logs = agent_result.all()

                # 3. Merge and Sort
                combined = []
                for log in sys_logs:
                    # Ensure timezone-aware UTC
                    ts = log.timestamp
                    if ts.tzinfo is None:
                        ts = ts.replace(tzinfo=datetime.timezone.utc)
                    combined.append({
                        "timestamp": ts.isoformat(),
                        "level": log.level,
                        "component": log.component,
                        "message": log.message,
                        "details": log.details,
                        "source": "system"
                    })
                
                for row in agent_logs:
                    log, agent_name = row
                    # Ensure timezone-aware UTC
                    ts = log.timestamp
                    if ts.tzinfo is None:
                        ts = ts.replace(tzinfo=datetime.timezone.utc)
                    combined.append({
                        "timestamp": ts.isoformat(),
                        "level": log.level,
                        "component": f"Agent: {agent_name}",
                        "message": log.message,
                        "details": log.details,
                        "source": "agent"
                    })

                # Sort by timestamp descending (now strings, but ISO format sorts correctly)
                combined.sort(key=lambda x: x["timestamp"], reverse=True)

                return combined[:limit]

        except Exception as e:
            logger.error(f"Failed to fetch logs from DB: {e}")
            return self.get_logs(limit) # Fallback to RAM

    def get_logs(self, limit: int = 50) -> List[Dict[str, Any]]:
        with self._lock:
            return list(self._logs)[:limit]

    def get_status(self) -> Dict[str, Any]:
        with self._lock:
            return {
                "app_uptime": "Calculated in frontend via boot time",  # simplified
                "components": self._components_status,
            }

# Global accessor
def get_monitor():
    return SystemMonitor.get_instance()
