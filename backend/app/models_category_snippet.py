from sqlalchemy import Column, Integer, String, Boolean
from .database import Base

class AssetTypeCategory(Base):
    __tablename__ = "asset_type_categories"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, index=True)
    description = Column(String, nullable=True)
    is_system = Column(Boolean, default=False)
