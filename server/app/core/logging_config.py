import os
import logging
import sys

class ContextFilter(logging.Filter):
    """
    Ensures user_id and endpoint context fields are always available to the formatter
    even when logger calls do not provide them via extra={}.
    """
    def filter(self, record: logging.LogRecord) -> bool:
        if not hasattr(record, "user_id"):
            record.user_id = "-"
        if not hasattr(record, "endpoint"):
            record.endpoint = "-"
        return True

def setup_logging():
    log_level_str = os.getenv("LOG_LEVEL", "INFO").upper()
    log_level = getattr(logging, log_level_str, logging.INFO)

    log_format = "%(asctime)s [%(levelname)s] [%(name)s] [user:%(user_id)s %(endpoint)s] %(message)s"
    
    root_logger = logging.getLogger()
    root_logger.setLevel(log_level)

    # Avoid duplicate handlers if setup_logging() is called multiple times
    if not root_logger.handlers:
        handler = logging.StreamHandler(sys.stdout)
        handler.setLevel(log_level)
        formatter = logging.Formatter(log_format, datefmt="%Y-%m-%d %H:%M:%S")
        handler.setFormatter(formatter)
        handler.addFilter(ContextFilter())
        root_logger.addHandler(handler)
    else:
        for handler in root_logger.handlers:
            handler.setLevel(log_level)
            formatter = logging.Formatter(log_format, datefmt="%Y-%m-%d %H:%M:%S")
            handler.setFormatter(formatter)
            if not any(isinstance(f, ContextFilter) for f in handler.filters):
                handler.addFilter(ContextFilter())

    # Tone down overly noisy third-party libraries if desired
    logging.getLogger("uvicorn.access").setLevel(logging.WARNING)

def get_logger(name: str) -> logging.Logger:
    logger = logging.getLogger(name)
    return logger
