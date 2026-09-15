from datetime import datetime
from sqlalchemy import Column, Integer, DateTime, Enum, ForeignKey, Index
from sqlalchemy.orm import relationship
from ..core.database import Base
from .user import TeamEnum

class TeamMembership(Base):
    """
    Append-only log for team memberships.
    Used to scope team chat history reads to the exact window(s)
    a user was actually a member of the team.
    """
    __tablename__ = "team_memberships"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    team = Column(Enum(TeamEnum), nullable=False, index=True)
    joined_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    left_at = Column(DateTime, nullable=True)  # null = currently active member

    __table_args__ = (
        Index("ix_team_memberships_user_team_left", "user_id", "team", "left_at"),
    )

    # Relationship
    user = relationship("User", back_populates="memberships")

