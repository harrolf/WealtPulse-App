"""Shared application constants."""

# File size limits
MAX_IMPORT_FILE_SIZE = 10 * 1024 * 1024  # 10MB

# Export/Import versioning
EXPORT_VERSION = "1.1"

# Portfolio calculation thresholds
MINIMUM_VALUE_THRESHOLD = 0.01  # Minimum portfolio value for percentage calculations

# Date format
DATE_FORMAT = "%Y-%m-%d"

# Currency setting keys (used in export/import)
CURRENCY_SETTING_KEYS = ["currencies", "main_currency", "secondary_currencies"]

# Default history range
DEFAULT_HISTORY_DAYS = 30
