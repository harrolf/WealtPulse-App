import logging
import sys


def setup_logging():
    """
    Configure structured logging for the application.
    """
    logger = logging.getLogger()
    logger.setLevel(logging.INFO)

    handler = logging.StreamHandler(sys.stdout)

    # Use a format that is easy to parse
    formatter = logging.Formatter(
        "%(asctime)s - %(name)s - %(levelname)s - %(message)s"
    )
    handler.setFormatter(formatter)

    # Avoid duplicate handlers
    if not any(isinstance(h, logging.StreamHandler) for h in logger.handlers):
        logger.addHandler(handler)

    # Attach MonitoredLoggingHandler for UI logs
    from app.services.monitoring import MonitoredLoggingHandler
    if not any(isinstance(h, MonitoredLoggingHandler) for h in logger.handlers):
        monitored_handler = MonitoredLoggingHandler()
        monitored_handler.setFormatter(formatter)
        logger.addHandler(monitored_handler)

    # Set levels for third-party libraries to avoid noise
    logging.getLogger("uvicorn.access").setLevel(logging.WARNING)
    logging.getLogger("sqlalchemy.engine").setLevel(logging.WARNING)
