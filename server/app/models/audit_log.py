from datetime import datetime
from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from ..core.database import Base

class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(Integer, primary_key=True, index=True)
    actor_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    action = Column(String(64), nullable=False, index=True)
    target = Column(String(128), nullable=True)
    details = Column(Text, nullable=False)
    ip_address = Column(String(64), default="127.0.0.1", nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False, index=True)

    actor = relationship("User")
