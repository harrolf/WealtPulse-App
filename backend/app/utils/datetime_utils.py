"""Datetime utilities for consistent UTC handling."""
from datetime import datetime, timezone


def utc_now() -> datetime:
    """
    Get current UTC time as a naive datetime object.

    Returns UTC time without timezone info to ensure compatibility with
    database columns (TIMESTAMP WITHOUT TIME ZONE) and strict drivers like asyncpg.
    """
    return datetime.now(timezone.utc).replace(tzinfo=None)
