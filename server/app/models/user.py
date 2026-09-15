import enum
from datetime import datetime
from sqlalchemy import Column, Integer, String, Boolean, DateTime, Enum, ForeignKey
from sqlalchemy.orm import relationship
from ..core.database import Base

class TeamEnum(str, enum.Enum):
    team_ai = "team_ai"
    team_legal = "team_legal"
    hr_admin = "hr_admin"
    seo = "seo"
    coordination = "coordination"

class UserStatus(str, enum.Enum):
    active = "active"
    disabled = "disabled"
    deleted = "deleted"

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    email = Column(String(255), unique=True, index=True, nullable=False)
    password_hash = Column(String(255), nullable=False)
    is_main_admin = Column(Boolean, default=False, nullable=False)
    team = Column(Enum(TeamEnum), nullable=True, index=True)
    is_team_leader = Column(Boolean, default=False, nullable=False)
    status = Column(Enum(UserStatus), default=UserStatus.active, nullable=False)
    created_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    # Relationships
    memberships = relationship("TeamMembership", back_populates="user", cascade="all, delete-orphan")
    sent_messages = relationship("Message", foreign_keys="Message.sender_id", back_populates="sender")
    received_messages = relationship("Message", foreign_keys="Message.receiver_id", back_populates="receiver")

    @property
    def account_status(self) -> UserStatus:
        return self.status

    @property
    def is_active(self) -> bool:
        return self.status == UserStatus.active

    @property
    def presence(self) -> str:
        return "offline"

