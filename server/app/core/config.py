import os
from pathlib import Path
from typing import List
from pydantic_settings import BaseSettings
from pydantic import field_validator, model_validator

class Settings(BaseSettings):
    PROJECT_NAME: str = "Personalize Chat"
    VERSION: str = "3.1.0"
    ENVIRONMENT: str = "development"
    LOG_LEVEL: str = "INFO"
    API_V1_STR: str = "/api"
    SECRET_KEY: str
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 15  # 15 minutes for short-lived access tokens
    REFRESH_TOKEN_EXPIRE_DAYS: int = 60  # 60 days for refresh tokens

    # CORS configuration: comma-separated list of allowed origins
    ALLOWED_ORIGINS: str = "http://localhost:5173,http://127.0.0.1:5173,http://localhost:5174,http://127.0.0.1:5174,http://localhost:3000"

    # Rate limiting
    RATE_LIMIT_ENABLED: bool = True

    @property
    def cors_origins(self) -> List[str]:
        if not self.ALLOWED_ORIGINS:
            return ["http://localhost:5173", "file://", "null"]
        origins = [origin.strip() for origin in self.ALLOWED_ORIGINS.split(",") if origin.strip()]
        for extra in ["file://", "null"]:
            if extra not in origins:
                origins.append(extra)
        return origins

    # Database: SQLite fallback for local development, PostgreSQL for Docker
    DATABASE_URL: str = os.getenv(
        "DATABASE_URL",
        f"sqlite:///{os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), 'personalize_chat.db').replace(chr(92), '/')}"
    )

    @field_validator("DATABASE_URL", mode="after")
    @classmethod
    def resolve_sqlite_path(cls, v: str) -> str:
        # Prevent relative CWD path ambiguity between root and server folders
        if v.startswith("sqlite:///./") or v == "sqlite:///personalize_chat.db":
            server_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
            db_path = os.path.join(server_dir, "personalize_chat.db").replace("\\", "/")
            return f"sqlite:///{db_path}"
        return v

    # File uploads
    UPLOAD_DIR: str = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), "uploads")
    DEFAULT_MAX_FILE_SIZE_MB: int = 500
    DEFAULT_LEADER_CEILING_MB: int = 2048

    # Initial Main-Admin bootstrap credentials (strictly environment-driven via .env)
    INITIAL_ADMIN_EMAIL: str
    INITIAL_ADMIN_NAME: str = "Main Admin"
    INITIAL_ADMIN_PASSWORD: str

    @field_validator("INITIAL_ADMIN_EMAIL", "INITIAL_ADMIN_PASSWORD")
    @classmethod
    def validate_admin_creds(cls, v: str) -> str:
        if not v or not v.strip():
            raise ValueError("INITIAL_ADMIN_EMAIL and INITIAL_ADMIN_PASSWORD must be configured and non-empty.")
        return v.strip()

    # Fixed 5 teams defined in master plan
    FIXED_TEAMS: List[str] = [
        "team_ai",
        "team_legal",
        "hr_admin",
        "seo",
        "coordination"
    ]

    @model_validator(mode="after")
    def validate_startup_environment(self) -> "Settings":
        errors = []
        # Check SECRET_KEY length without exposing its content
        if not self.SECRET_KEY or len(self.SECRET_KEY.strip()) < 32:
            key_len = len(self.SECRET_KEY) if self.SECRET_KEY else 0
            errors.append(f"SECRET_KEY: value is too short ({key_len} characters). Must be at least 32 characters.")

        if not self.DATABASE_URL or not self.DATABASE_URL.strip():
            errors.append("DATABASE_URL: database connection URL must be specified and non-empty.")

        # In production, disallow pure localhost CORS and wildcard origins
        if self.ENVIRONMENT.lower() == "production":
            origins = self.cors_origins
            raw_configured = [o.strip() for o in (self.ALLOWED_ORIGINS or "").split(",") if o.strip()]
            if any(o == "*" for o in raw_configured):
                errors.append(
                    "ALLOWED_ORIGINS: Wildcard origin '*' is strictly prohibited in production when credentials are enabled."
                )
            web_origins = [o for o in origins if o not in ["file://", "null", "*"]]
            if not web_origins or all("localhost" in o or "127.0.0.1" in o for o in web_origins):
                errors.append(
                    "ALLOWED_ORIGINS: ENVIRONMENT=production requires explicit production domains in ALLOWED_ORIGINS "
                    "(cannot rely solely on localhost/127.0.0.1)."
                )

        if errors:
            formatted = "\n  * " + "\n  * ".join(errors)
            raise ValueError(f"Environment configuration validation failed:{formatted}")

        return self

    class Config:
        env_file = [
            ".env",
            os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), ".env"),
            os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))), ".env")
        ]
        extra = "allow"

try:
    settings = Settings()
except Exception as e:
    import sys
    sys.stderr.write(
        f"\n=======================================================\n"
        f"FATAL STARTUP CONFIGURATION ERROR:\n{e}\n"
        f"=======================================================\n\n"
    )
    raise RuntimeError(f"Required configuration missing or invalid: {e}") from None

# Ensure uploads directory exists
os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
