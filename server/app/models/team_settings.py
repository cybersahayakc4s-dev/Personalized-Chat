from datetime import datetime
from sqlalchemy import Column, Integer, DateTime, Enum, ForeignKey
from ..core.database import Base
from .user import TeamEnum

class TeamSettings(Base):
    """
    Per-team settings for file size limits and leader ceilings.
    """
    __tablename__ = "team_settings"

    team = Column(Enum(TeamEnum), primary_key=True)
    max_file_size_mb = Column(Integer, default=500, nullable=False)
    leader_ceiling_mb = Column(Integer, default=2048, nullable=False)
    updated_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
