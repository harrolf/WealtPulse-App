import asyncio
from app.database import SessionLocal
from app.models import SystemAgent
from sqlalchemy import select

async def check_agents():
    async with SessionLocal() as db:
        result = await db.execute(select(SystemAgent))
        agents = result.scalars().all()
        for agent in agents:
            print(f"Agent: {agent.name}")
            print(f"Config: {agent.config}")
            print("-" * 20)

if __name__ == "__main__":
    asyncio.run(check_agents())
