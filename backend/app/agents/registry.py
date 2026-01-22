from typing import List, Dict, Optional
from .base import BaseAgent
from .history_backfill import HistoryBackfillAgent
from .market_compactor import MarketCompactorAgent
from .price_updater import PriceUpdaterAgent
from .cleanup import SystemCleanupAgent

class AgentRegistry:
    _instance = None
    _agents: Dict[str, BaseAgent] = {}

    def __init__(self):
        # Register all agents in memory
        self.register(HistoryBackfillAgent.get_instance())
        self.register(MarketCompactorAgent.get_instance())
        self.register(PriceUpdaterAgent.get_instance())
        self.register(SystemCleanupAgent.get_instance())

    async def initialize(self):
        """Ensure all registered agents exist in the database."""
        from app.database import SessionLocal
        async with SessionLocal() as db:
            for agent in self._agents.values():
                await agent._get_or_create_agent_record(db)

    @classmethod
    def get_instance(cls):
        if cls._instance is None:
            cls._instance = cls()
        return cls._instance

    def register(self, agent: BaseAgent):
        self._agents[agent.name] = agent

    def get_agent(self, name: str) -> Optional[BaseAgent]:
        return self._agents.get(name)

    def get_all_agents(self) -> List[BaseAgent]:
        return list(self._agents.values())

def get_agent_registry():
    return AgentRegistry.get_instance()
