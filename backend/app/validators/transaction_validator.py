from decimal import Decimal
from typing import Any
from datetime import timezone, timedelta
from app.schemas import TransactionCreate
from ..utils.datetime_utils import utc_now


class TransactionValidator:
    # Constants for validation limits
    MAX_TRANSACTION_VALUE = Decimal("1000000000000")  # 1 Trillion
    MAX_ASSET_QUANTITY = Decimal("1000000000")  # 1 Billion units

    @staticmethod
    def validate_transaction(
        transaction: TransactionCreate, asset: Any, current_quantity: Decimal
    ):
        """
        Validates transaction data integrity.

        Args:
            transaction: The transaction data payload.
            asset: The asset object associated with the transaction.
            current_quantity: The current quantity of the asset held by the user.

        Raises:
            ValueError: If validation fails.
        """
        # 0. Sanity Check for Infinity/NaN
        if (
            transaction.price_per_unit.is_infinite()
            or transaction.price_per_unit.is_nan()
        ):
            raise ValueError("Price per unit must be a finite number")
        if (
            transaction.quantity_change.is_infinite()
            or transaction.quantity_change.is_nan()
        ):
            raise ValueError("Quantity change must be a finite number")

        # 1. Check date not in future
        # Handle timezone-naive dates by assuming UTC, or convert aware to UTC
        txn_date = transaction.date
        if txn_date.tzinfo is None:
            # If naive, assume UTC as per project standard
            txn_date = txn_date.replace(tzinfo=timezone.utc)

        now_val = utc_now()

        # Allow small clock skew (e.g. 5 minutes)
        if txn_date > (now_val + timedelta(minutes=5)):
            raise ValueError(
                f"Transaction date cannot be in the future (Time: {txn_date})"
            )

        # 2. Check price
        if transaction.price_per_unit < 0:
            raise ValueError("Price per unit cannot be negative")

        if transaction.fees < 0:
            raise ValueError("Fees cannot be negative")

        # Check Max Price/Value
        if transaction.price_per_unit > TransactionValidator.MAX_TRANSACTION_VALUE:
            raise ValueError(
                f"Price per unit exceeds maximum allowed ({TransactionValidator.MAX_TRANSACTION_VALUE})"
            )

        total_value = abs(transaction.quantity_change * transaction.price_per_unit)
        if total_value > TransactionValidator.MAX_TRANSACTION_VALUE:
            raise ValueError(
                f"Total transaction value exceeds maximum allowed ({TransactionValidator.MAX_TRANSACTION_VALUE})"
            )

        # 3. Check quantity
        if abs(transaction.quantity_change) > TransactionValidator.MAX_ASSET_QUANTITY:
            raise ValueError(
                f"Quantity change exceeds maximum allowed ({TransactionValidator.MAX_ASSET_QUANTITY})"
            )

        # Check resulting quantity
        new_quantity = current_quantity + transaction.quantity_change

        if new_quantity < 0:
            raise ValueError(
                f"Transaction would result in negative asset quantity ({new_quantity}). Short selling not allowed."
            )

        if new_quantity > TransactionValidator.MAX_ASSET_QUANTITY:
            # This might be valid for some whales, but good sanity check?
            # Let's keep it as a safeguard.
            raise ValueError(
                f"Transaction would result in asset quantity exceeding limit ({TransactionValidator.MAX_ASSET_QUANTITY})"
            )

        return True
