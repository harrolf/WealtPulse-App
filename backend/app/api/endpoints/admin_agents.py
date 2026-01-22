from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks, Body
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc
from typing import List, Dict, Any
from app.database import get_db
from app.models import User, SystemAgent, AgentLog
from app.api.deps import get_current_admin
from app.agents.registry import get_agent_registry
from pydantic import BaseModel, field_serializer
import datetime

router = APIRouter()

class AgentSummary(BaseModel):
    id: int
    name: str
    description: str | None
    status: str
    is_enabled: bool
    last_run_at: datetime.datetime | None
    next_run_at: datetime.datetime | None
    last_duration_ms: int | None
    last_error: str | None
    schedule_type: str
    schedule_value: str | None
    config: Dict[str, Any] = {}
    agent_metadata: Dict[str, Any] = {}

    @field_serializer('last_run_at', 'next_run_at')
    def serialize_dt(self, dt: datetime.datetime | None, _info):
        if dt is None:
            return None
        # Ensure timezone-aware UTC
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=datetime.timezone.utc)
        return dt.isoformat()

class AgentLogEntry(BaseModel):
    id: int
    level: str
    message: str
    details: Dict[str, Any] | None
    timestamp: datetime.datetime

    @field_serializer('timestamp')
    def serialize_dt(self, dt: datetime.datetime, _info):
        # Ensure timezone-aware UTC
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=datetime.timezone.utc)
        return dt.isoformat()

@router.get("/", response_model=List[AgentSummary])
async def list_agents(
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_current_admin)
):
    stmt = select(SystemAgent).order_by(SystemAgent.name)
    result = await db.execute(stmt)
    return result.scalars().all()

@router.get("/{name}/logs", response_model=List[AgentLogEntry])
async def get_agent_logs(
    name: str,
    limit: int = 100,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_current_admin)
):
    stmt = select(SystemAgent).where(SystemAgent.name == name)
    result = await db.execute(stmt)
    agent = result.scalar_one_or_none()
    
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")
        
    stmt = select(AgentLog).where(AgentLog.agent_id == agent.id).order_by(desc(AgentLog.timestamp)).limit(limit)
    result = await db.execute(stmt)
    return result.scalars().all()

@router.post("/{name}/trigger")
async def trigger_agent(
    name: str,
    background_tasks: BackgroundTasks,
    params: Dict[str, Any] = Body(default={}),
    admin: User = Depends(get_current_admin)
):
    registry = get_agent_registry()
    agent = registry.get_agent(name)
    
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")
        
    # Trigger in background
    background_tasks.add_task(agent.run, **params)
    
    return {"message": f"Agent {name} triggered"}

@router.post("/{name}/stop")
async def stop_agent(
    name: str,
    admin: User = Depends(get_current_admin)
):
    registry = get_agent_registry()
    agent = registry.get_agent(name)
    
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")
        
    stopped = agent.stop()
    
    if stopped:
        return {"message": f"Agent {name} stop requested"}
    else:
        return {"message": f"Agent {name} is not currently running"}

@router.patch("/{name}")
async def update_agent_config(
    name: str,
    payload: Dict[str, Any],
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_current_admin)
):
    stmt = select(SystemAgent).where(SystemAgent.name == name)
    result = await db.execute(stmt)
    agent = result.scalar_one_or_none()
    
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")
        
    if "is_enabled" in payload:
        agent.is_enabled = payload["is_enabled"]
    if "config" in payload:
        agent.config = payload["config"]
    if "schedule_type" in payload:
        agent.schedule_type = payload["schedule_type"]
    if "schedule_value" in payload:
        agent.schedule_value = payload["schedule_value"]
        
    await db.commit()
    return {"message": "Agent configuration updated"}
