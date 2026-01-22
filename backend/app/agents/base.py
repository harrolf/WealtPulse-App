import asyncio
import logging
import traceback
from typing import Optional, Dict, Any
from sqlalchemy import select
from app.database import SessionLocal
from app.models import SystemAgent, AgentLog
from app.utils.datetime_utils import utc_now

logger = logging.getLogger(__name__)

class BaseAgent:
    name: str = "Base Agent"
    description: str = ""
    schedule_type: str = "manual"  # manual, interval, cron
    schedule_value: Optional[str] = None
    
    default_config: Dict[str, Any] = {}
    
    def __init__(self):
        self._is_running = False
        self._current_task: Optional[asyncio.Task] = None

    async def _get_or_create_agent_record(self, db):
        stmt = select(SystemAgent).where(SystemAgent.name == self.name)
        result = await db.execute(stmt)
        agent = result.scalar_one_or_none()
        
        if not agent:
            agent = SystemAgent(
                name=self.name,
                description=self.description,
                schedule_type=self.schedule_type,
                schedule_value=self.schedule_value,
                status="idle",
                config=self.default_config
            )
            db.add(agent)
            await db.commit()
            await db.refresh(agent)
        else:
            # Sync class-level definitions to DB if changed
            updated_fields = False
            if agent.description != self.description:
                agent.description = self.description
                updated_fields = True
            
            # Optional: Sync default schedule if DB has defaults but code changed? 
            # Better to only sync description to avoid overriding user custom schedules.
            # But let's sync description for sure.
            
            # Seed default config keys if missing
            current_config = dict(agent.config) if agent.config else {}
            if self.default_config:
                for k, v in self.default_config.items():
                    if k not in current_config:
                        current_config[k] = v
                        updated_fields = True
            
            if updated_fields:
                agent.config = current_config
                db.add(agent)
                await db.commit()
                await db.refresh(agent)
                    
        return agent

    async def log(self, level: str, message: str, details: Optional[Dict] = None):
        """Log a message for this agent."""
        logger.info(f"[{self.name}] {message}")
        
        # Store in Agent Logs (DB)
        async with SessionLocal() as db:
            agent = await self._get_or_create_agent_record(db)
            log_entry = AgentLog(
                agent_id=agent.id,
                level=level,
                message=message,
                details=details
            )
            db.add(log_entry)
            await db.commit()

    async def run(self, **kwargs):
        """Outer wrapper to handle state and errors."""
        if self._is_running:
            logger.warning(f"Agent {self.name} is already running.")
            return

        self._is_running = True
        start_time = utc_now()
        
        agent_config = {}
        
        async with SessionLocal() as db:
            agent = await self._get_or_create_agent_record(db)
            agent.status = "running"
            agent.last_run_at = start_time
            agent.last_error = None
            
            # Extract config while session is open to avoid DetachedInstanceError later
            if agent.config:
                agent_config = dict(agent.config)
            
            await db.commit()

        await self.log("INFO", f"Agent {self.name} started.")
        
        try:
            # Set current task so it can be cancelled
            self._current_task = asyncio.current_task()
            
            # Pass agent config to execute
            await self.execute(agent_config=agent_config, **kwargs)
            
            end_time = utc_now()
            duration_ms = int((end_time - start_time).total_seconds() * 1000)
            
            async with SessionLocal() as db:
                agent = await self._get_or_create_agent_record(db)
                agent.status = "idle"
                agent.last_duration_ms = duration_ms
                await db.commit()
            
            await self.log("SUCCESS", f"Agent {self.name} completed successfully in {duration_ms}ms.")
            
        except asyncio.CancelledError:
            await self.log("WARNING", f"Agent {self.name} was cancelled.")
            async with SessionLocal() as db:
                agent = await self._get_or_create_agent_record(db)
                agent.status = "idle"
                await db.commit()
            raise
        except Exception as e:
            error_msg = f"Error: {str(e)}\n{traceback.format_exc()}"
            logger.error(f"Agent {self.name} failed: {error_msg}")
            await self.log("ERROR", f"Agent {self.name} failed: {str(e)}", details={"traceback": traceback.format_exc()})
            
            async with SessionLocal() as db:
                agent = await self._get_or_create_agent_record(db)
                agent.status = "failed"
                agent.last_error = str(e)
                await db.commit()
        finally:
            self._is_running = False
            self._current_task = None

    async def update_metadata(self, metadata: Dict[str, Any]):
        """Update the agent's metadata in the database."""
        async with SessionLocal() as db:
            agent = await self._get_or_create_agent_record(db)
            if agent.agent_metadata is None:
                agent.agent_metadata = {}
            # Update the dict
            new_metadata = dict(agent.agent_metadata)
            new_metadata.update(metadata)
            agent.agent_metadata = new_metadata
            await db.commit()

    async def execute(self, **kwargs):
        """Actual logic to be implemented by subclasses."""
        raise NotImplementedError("Subclasses must implement execute()")

    def stop(self):
        """Stop the currently running task."""
        if self._current_task and not self._current_task.done():
            self._current_task.cancel()
            return True
        return False
