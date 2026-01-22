from decimal import Decimal
from typing import List, Dict
import datetime


class PerformanceCalculator:
    @staticmethod
    def calculate_twr(
        start_value: Decimal, end_value: Decimal, net_flow: Decimal
    ) -> Decimal:
        """
        Calculate Simple Time-Weighted Return for a period.
        TWR = (EndValue - NetFlows) / StartValue - 1

        Note: True TWR requires sub-period linking on every flow.
        This is "Simple Return" approx if flows are small or "Modified Dietz" if weighted.

        WealthPulse monolith used: (End - Flow) / Start - 1 ??
        Actually, let's look at `portfolio_analytics.py`:
        It did geometric linking of daily returns.
        """
        if start_value == 0:
            if net_flow > 0:
                return Decimal("0.0")  # Start 0, added money -> Return is 0% (base)
            return Decimal("0.0")

        # Avoid division by zero
        if start_value + net_flow == 0:
            return Decimal("0.0")

        # Simple return (not accurate for significant mid-period flows)
        # End = Start * (1+r) + Flow
        # End - Flow = Start * (1+r)
        # (End - Flow)/Start = 1+r
        # r = (End - Flow)/Start - 1

        return (end_value - net_flow) / start_value - Decimal("1.0")

    @staticmethod
    def calculate_mwr(
        start_value: Decimal,
        end_value: Decimal,
        flows: List[Dict],  # {date, amount}
        start_date: datetime.date,
        end_date: datetime.date,
    ) -> Decimal:
        """
        Calculate Money-Weighted Return (XIRR).
        """
        # Prepare cashflows for XIRR
        # 1. Initial Outflow (Start Value) at start_date
        cfs = [(-float(start_value), start_date)]

        # 2. Flows (Deposits = negative for investor? No, XIRR usually:
        #    Investment = Negative
        #    Return = Positive
        #    So Start Value = Negative (Invested)
        #    Flows: Buy (Invest more) = Negative. Sell (Withdraw) = Positive.
        #    End Value = Positive (liquidated)

        # Wait, usually:
        # User perspective:
        # Value 100.
        # Add 50. (Flow)
        # Value now 150.
        # XIRR is about internals.

        # Standard XIRR stream:
        # Date 0: -100 (Initial Investment)
        # Date 10: -50 (Additional Investment)
        # Date 30: +160 (Final Value)

        for f in flows:
            amt = float(f["amount"])  # + means deposit in this context?
            # If flow is "Net Invested Capital", then + means Deposit.
            # So for XIRR, Deposit is an outflow from pocket.
            cfs.append((-amt, f["date"]))

        # 3. Final Inflow (End Value)
        cfs.append((float(end_value), end_date))

        try:
            from app.math_utils import xirr

            res = xirr(cfs)
            return Decimal(str(res)) if res is not None else Decimal("0.0")
        except Exception:
            return Decimal("0.0")
