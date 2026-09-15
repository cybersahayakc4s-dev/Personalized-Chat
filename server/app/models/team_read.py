from datetime import datetime
from sqlalchemy import Column, Integer, DateTime, Enum, ForeignKey, UniqueConstraint
from sqlalchemy.orm import relationship
from ..core.database import Base
from .user import TeamEnum

class TeamReadReceipt(Base):
    """
    Tracks the last time a user viewed or read messages in a specific team channel.
    Used to calculate unread message counts per user and per team.
    """
    __tablename__ = "team_read_receipts"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    team = Column(Enum(TeamEnum), nullable=False, index=True)
    last_read_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    __table_args__ = (
        UniqueConstraint("user_id", "team", name="uq_team_read_user_team"),
    )

    # Relationship
    user = relationship("User")

