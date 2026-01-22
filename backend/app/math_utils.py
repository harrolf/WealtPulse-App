"""Math utility functions for portfolio calculations."""
import math
from typing import Optional, List, Tuple, Union
from datetime import date
from decimal import Decimal, InvalidOperation, ROUND_HALF_UP


def sanitize_float(val: Optional[Union[float, Decimal]]) -> float:
    """Convert NaN/Inf and Decimals to 0.0/float for JSON-safe responses."""
    if val is None:
        return 0.0
    if isinstance(val, Decimal):
        return float(val)
    if isinstance(val, (int, float)):
        if math.isnan(val) or math.isinf(val):
            return 0.0
    return float(val)


def safe_divide(
    numerator: Union[float, Decimal],
    denominator: Union[float, Decimal],
    default: float = 0.0,
) -> Union[float, Decimal]:
    """Safely divide two numbers, returning default if denominator is zero."""
    if denominator == 0 or denominator is None:
        return default

    try:
        return numerator / denominator
    except (ZeroDivisionError, InvalidOperation):
        return default


def sanitize_decimal(val: Optional[Union[float, Decimal]], prec: int = 8) -> Decimal:
    """Convert value to Decimal, handling None/NaN, and quantize."""
    d_val = Decimal("0.0")
    if val is None:
        pass
    elif isinstance(val, (int, float)):
        if math.isnan(val) or math.isinf(val):
            pass
        else:
            d_val = Decimal(str(val))
    elif isinstance(val, Decimal):
        if val.is_nan() or val.is_infinite():
            pass
        else:
            d_val = val

    # Quantize
    try:
        quantizer = Decimal("1." + "0" * prec)
        return d_val.quantize(quantizer, rounding=ROUND_HALF_UP)
    except InvalidOperation:
        return d_val


def xirr(cash_flows: List[Tuple[date, float]], guess: float = 0.1) -> Optional[float]:
    """
    Calculate the Extended Internal Rate of Return (XIRR).

    Args:
        cash_flows: List of (date, amount) tuples.
                    Cash flows must contain at least one positive and one negative value.
        guess: Initial guess for the rate of return (default: 0.1 or 10%).

    Returns:
        The internal rate of return, or None if calculation fails to converge.
        The result is an annualized rate (e.g., 0.05 for 5%).
    """
    if not cash_flows:
        return None

    positive = False
    negative = False
    for _, amount in cash_flows:
        if amount > 0:
            positive = True
        if amount < 0:
            negative = True

    if not (positive and negative):
        return None

    # Sort by date
    cash_flows.sort(key=lambda x: x[0])

    start_date = cash_flows[0][0]

    def total_present_value(rate):
        if rate <= -1.0:
            return float("inf")
        total = 0.0
        for d, amount in cash_flows:
            days = (d - start_date).days
            total += amount / math.pow(1 + rate, days / 365.0)
        return total

    def total_present_value_derivative(rate):
        if rate <= -1.0:
            return float("inf")
        total = 0.0
        for d, amount in cash_flows:
            days = (d - start_date).days
            total += -amount * (days / 365.0) / math.pow(1 + rate, (days / 365.0) + 1)
        return total

    rate = guess
    for _ in range(50):  # Max iterations
        try:
            f_val = total_present_value(rate)
            df_val = total_present_value_derivative(rate)

            if abs(f_val) < 1e-6:
                return rate

            if df_val == 0:
                return None

            new_rate = rate - f_val / df_val
            if abs(new_rate - rate) < 1e-6:
                return new_rate

            rate = new_rate
        except (OverflowError, ZeroDivisionError):
            return None

    return None
