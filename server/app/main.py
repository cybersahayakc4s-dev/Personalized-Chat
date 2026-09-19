import os
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text
import socketio

from .core.config import settings
from .core.logging_config import setup_logging, get_logger
from .core.database import SessionLocal
from .core.limiter import limiter, custom_rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from .seed import init_db
from .api.auth import router as auth_router
from .api.admin import router as admin_router
from .api.users import router as users_router
from .api.teams import router as teams_router
from .api.messages import router as messages_router
from .api.attachments import router as attachments_router
from .sockets.manager import sio

# Initialize structured logging early
setup_logging()
logger = get_logger("app.main")

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Initialize DB tables and initial admin
    logger.info(f"Starting {settings.PROJECT_NAME} in [{settings.ENVIRONMENT}] mode...")
    init_db()
    yield
    logger.info(f"Shutting down {settings.PROJECT_NAME}...")

app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    openapi_url=f"{settings.API_V1_STR}/openapi.json",
    lifespan=lifespan
)

# Rate limiting
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, custom_rate_limit_exceeded_handler)

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount API routers
app.include_router(auth_router, prefix=settings.API_V1_STR)
app.include_router(admin_router, prefix=settings.API_V1_STR)
app.include_router(users_router, prefix=settings.API_V1_STR)
app.include_router(teams_router, prefix=settings.API_V1_STR)
app.include_router(messages_router, prefix=settings.API_V1_STR)
app.include_router(attachments_router, prefix=settings.API_V1_STR)

@app.get("/health")
def health_check():
    checks = {}
    is_healthy = True

    # 1. Database connectivity check
    db = None
    try:
        db = SessionLocal()
        db.execute(text("SELECT 1")).scalar()
        checks["database"] = "ok"
    except Exception as e:
        is_healthy = False
        checks["database"] = f"fail: {str(e)}"
        logger.error(f"Health check database failure: {e}", exc_info=True)
    finally:
        if db:
            db.close()

    # 2. Storage write/delete probe check
    probe_file = os.path.join(settings.UPLOAD_DIR, ".health_check_probe")
    try:
        os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
        # Write to single fixed probe file (overwrites itself, eliminating accumulation)
        with open(probe_file, "w", encoding="utf-8") as f:
            f.write("probe")
        # Attempt safe removal
        try:
            if os.path.exists(probe_file):
                os.remove(probe_file)
        except Exception as cleanup_err:
            logger.warning(f"Health check probe cleanup warning: {cleanup_err}")
        checks["storage"] = "ok"
    except Exception as e:
        is_healthy = False
        checks["storage"] = f"fail: {str(e)}"
        logger.error(f"Health check storage probe failure: {e}", exc_info=True)
        try:
            if os.path.exists(probe_file):
                os.remove(probe_file)
        except Exception:
            pass

    status_str = "healthy" if is_healthy else "unhealthy"
    status_code = 200 if is_healthy else 503

    return JSONResponse(
        status_code=status_code,
        content={
            "status": status_str,
            "service": settings.PROJECT_NAME,
            "version": settings.VERSION,
            "checks": checks
        }
    )

# Combine FastAPI and Socket.IO into a single ASGI app
combined_asgi_app = socketio.ASGIApp(
    socketio_server=sio,
    other_asgi_app=app,
    socketio_path="socket.io"
)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "app.main:combined_asgi_app",
        host="0.0.0.0",
        port=8000,
        reload=True,
        reload_dirs=["app"],
        timeout_graceful_shutdown=1
    )

