from datetime import datetime
from sqlalchemy import Column, Integer, String, Text, DateTime, Enum, ForeignKey, Boolean, CheckConstraint, Index
from sqlalchemy.orm import relationship
from ..core.database import Base
from .user import TeamEnum

class Message(Base):
    __tablename__ = "messages"

    id = Column(Integer, primary_key=True, index=True)
    sender_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    receiver_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)  # Set for 1:1 DMs
    team = Column(Enum(TeamEnum), nullable=True, index=True)  # Set for team group chat
    content = Column(Text, nullable=True)
    reply_to_id = Column(Integer, ForeignKey("messages.id"), nullable=True, index=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False, index=True)
    edited_at = Column(DateTime, nullable=True)
    deleted_at = Column(DateTime, nullable=True)
    deleted_by_admin = Column(Boolean, default=False, nullable=False)
    read_at = Column(DateTime, nullable=True)  # DM-only, powers seen indicator
    is_pinned = Column(Boolean, default=False, nullable=False, index=True)
    format = Column(String(32), default="plain", nullable=True)

    __table_args__ = (
        CheckConstraint(
            "(CASE WHEN team IS NOT NULL THEN 1 ELSE 0 END + "
            "CASE WHEN receiver_id IS NOT NULL THEN 1 ELSE 0 END + "
            "CASE WHEN (format LIKE 'channel:%') THEN 1 ELSE 0 END) = 1",
            name="ck_messages_destination_exact_one"
        ),
        Index("ix_messages_sender_receiver_created", "sender_id", "receiver_id", "created_at"),
        Index("ix_messages_receiver_sender_created", "receiver_id", "sender_id", "created_at"),
        Index("ix_messages_team_created", "team", "created_at"),
        Index("ix_messages_receiver_read_deleted", "receiver_id", "read_at", "deleted_at"),
    )

    # Relationships
    sender = relationship("User", foreign_keys=[sender_id], back_populates="sent_messages")
    receiver = relationship("User", foreign_keys=[receiver_id], back_populates="received_messages")
    reply_to_message = relationship("Message", remote_side=[id], foreign_keys=[reply_to_id])
    attachments = relationship("Attachment", back_populates="message", cascade="all, delete-orphan")
    reactions = relationship("MessageReaction", back_populates="message", cascade="all, delete-orphan")

