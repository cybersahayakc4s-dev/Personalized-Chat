from sqlalchemy import Column, Integer, String, Text, Boolean
from ..core.database import Base

class WorkspaceSettings(Base):
    __tablename__ = "workspace_settings"

    id = Column(Integer, primary_key=True, index=True)
    workspace_name = Column(String(128), default="Cyber Sahayak", nullable=False)
    domain = Column(String(128), default="internal.personalize.net", nullable=False)
    retention_days = Column(Integer, default=365, nullable=False)
    allow_file_uploads = Column(Boolean, default=True, nullable=False)
    max_upload_size_bytes = Column(Integer, default=524288000, nullable=False)  # 500MB
    maintenance_notice = Column(Text, nullable=True)
    sound_enabled = Column(Boolean, default=True, nullable=False)
    allow_custom_channels = Column(Boolean, default=False, nullable=False)
