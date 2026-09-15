import sys
from fastapi import Request
from fastapi.responses import JSONResponse
from slowapi import Limiter
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from .config import settings
from .logging_config import get_logger

logger = get_logger("app.core.limiter")

def get_user_or_ip(request: Request) -> str:
    """Returns user identifier if authenticated, otherwise client IP address."""
    user = getattr(request.state, "user", None)
    if user and hasattr(user, "id"):
        return f"user:{user.id}"
    auth = request.headers.get("Authorization")
    if auth and auth.startswith("Bearer "):
        token = auth.split(" ")[1]
        return f"token:{token[-16:]}"
    return get_remote_address(request)

is_testing = "pytest" in sys.modules

limiter = Limiter(
    key_func=get_remote_address,
    enabled=settings.RATE_LIMIT_ENABLED and not is_testing
)

def custom_rate_limit_exceeded_handler(request: Request, exc: RateLimitExceeded) -> JSONResponse:
    """Returns a structured 429 Too Many Requests response with a clear error message."""
    response = JSONResponse(
        status_code=429,
        content={"detail": f"Rate limit exceeded: {exc.detail}. Please wait before retrying."}
    )
    try:
        response = request.app.state.limiter._inject_headers(response, request.state.view_rate_limit)
    except Exception as e:
        logger.error(f"Failed to inject rate limit headers: {e}", exc_info=True)
    return response
