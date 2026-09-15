from sqlalchemy import Column, Integer, BigInteger, String, ForeignKey
from sqlalchemy.orm import relationship
from ..core.database import Base

class Attachment(Base):
    __tablename__ = "attachments"

    id = Column(Integer, primary_key=True, index=True)
    message_id = Column(Integer, ForeignKey("messages.id"), nullable=False, index=True)
    file_name = Column(String(255), nullable=False)
    file_path = Column(String(500), nullable=False)
    file_size_bytes = Column(BigInteger, nullable=False)
    mime_type = Column(String(100), nullable=False)

    # Relationship
    message = relationship("Message", back_populates="attachments")
