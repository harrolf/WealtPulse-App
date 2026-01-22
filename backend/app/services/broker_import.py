"""
Generic Broker/Exchange Import Service

Auto-detects and parses transaction files from various brokers and exchanges.
Supports: eToro, Interactive Brokers, Degiro, Binance, Coinbase, etc.
"""

from typing import List, Dict, Any, Optional, Tuple
from enum import Enum
from datetime import datetime
import logging

logger = logging.getLogger(__name__)


class BrokerType(str, Enum):
    """Supported broker/exchange types."""
    ETORO = "etoro"
    INTERACTIVE_BROKERS = "interactive_brokers"
    DEGIRO = "degiro"
    BINANCE = "binance"
    COINBASE = "coinbase"
    KRAKEN = "kraken"
    REVOLUT = "revolut"
    TRADING212 = "trading212"
    UNKNOWN = "unknown"


class BrokerDetector:
    """Detects broker/exchange from CSV file content."""
    
    @staticmethod
    def detect(content: bytes, filename: str = "") -> BrokerType:
        """
        Auto-detect broker type from file content and filename.
        
        Args:
            content: File content (bytes)
            filename: Original filename (optional, helps with detection)
            
        Returns:
            Detected BrokerType
        """
        filename_lower = filename.lower()
        
        # Check filename first (crucial for binary files like XLSX, PDF)
        if 'etoro' in filename_lower:
            return BrokerType.ETORO
        
        # for binary files, we mostly rely on filename for now
        if filename_lower.endswith(('.xlsx', '.xls', '.pdf')):
            # we could add deep inspection here if needed
            pass

        # For text files, try to decode and inspect content
        try:
            text_content = content.decode('utf-8', errors='ignore')
            content_lower = text_content.lower()
            
            # Filename hints
            if 'interactive' in filename_lower or 'ibkr' in filename_lower:
                return BrokerType.INTERACTIVE_BROKERS
            if 'degiro' in filename_lower:
                return BrokerType.DEGIRO
            if 'binance' in filename_lower:
                return BrokerType.BINANCE
            if 'coinbase' in filename_lower:
                return BrokerType.COINBASE
            if 'kraken' in filename_lower:
                return BrokerType.KRAKEN
            if 'revolut' in filename_lower:
                return BrokerType.REVOLUT
            if 'trading212' in filename_lower or 'trading 212' in filename_lower:
                return BrokerType.TRADING212
            
            # Content detection
            if 'position id' in content_lower and 'realized equity' in content_lower:
                return BrokerType.ETORO
            
            if 'ibkr' in content_lower or 'interactive brokers' in content_lower:
                return BrokerType.INTERACTIVE_BROKERS
            
            if 'degiro' in content_lower or 'isin' in content_lower:
                return BrokerType.DEGIRO
            
            if 'binance' in content_lower or ('utc time' in content_lower and 'coin' in content_lower):
                return BrokerType.BINANCE
            
            if 'coinbase' in content_lower or 'transaction type' in content_lower:
                return BrokerType.COINBASE
            
            if 'kraken' in content_lower or ('txid' in content_lower and 'refid' in content_lower):
                return BrokerType.KRAKEN
            
            if 'revolut' in content_lower:
                return BrokerType.REVOLUT
            
            if 'trading 212' in content_lower or 'trading212' in content_lower:
                return BrokerType.TRADING212
            
        except Exception as e:
            logger.warning(f"Error during broker detection: {e}")
        
        return BrokerType.UNKNOWN


class GenericTransaction:
    """Generic transaction format that all parsers convert to."""
    
    def __init__(self, data: Dict[str, Any]):
        self.date = data.get('date')
        self.type = data.get('type')  # buy, sell, dividend, deposit, withdrawal, fee
        self.ticker = data.get('ticker')
        self.asset_name = data.get('asset_name')
        self.quantity = data.get('quantity', 0)
        self.price = data.get('price', 0)
        self.amount = data.get('amount', 0)
        self.currency = data.get('currency', 'USD')
        self.fee = data.get('fee', 0)
        self.notes = data.get('notes', '')
        self.raw_data = data.get('raw_data', {})
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            'date': self.date.isoformat() if self.date else None,
            'type': self.type,
            'ticker': self.ticker,
            'asset_name': self.asset_name,
            'quantity': float(self.quantity) if self.quantity else 0,
            'price': float(self.price) if self.price else 0,
            'amount': float(self.amount) if self.amount else 0,
            'currency': self.currency,
            'fee': float(self.fee) if self.fee else 0,
            'notes': self.notes,
        }


class BrokerParser:
    """Base class for broker-specific parsers."""
    
    def parse(self, content: bytes, filename: str) -> List[GenericTransaction]:
        """Parse broker-specific file and return generic transactions."""
        raise NotImplementedError


class EToroParser(BrokerParser):
    """Parser for eToro exports (CSV, XLSX, PDF)."""
    
    def parse(self, content: bytes, filename: str) -> Tuple[List[GenericTransaction], Dict[str, Any]]:
        from app.services.etoro_import import etoro_import_service, EToroImportService
        
        # Use existing eToro parser
        etoro_transactions, summary_data = etoro_import_service.parse_file(content, filename)
        
        # Convert to generic format
        generic_transactions = []
        for txn in etoro_transactions:
            # (Same logic as before for transactions)
            details = txn.details.strip()
            if details in ['-', '']:
                if txn.type.lower() not in ['deposit', 'withdrawal', 'interest']:
                    continue
                details = f"eToro {txn.type.capitalize()}"

            ticker = EToroImportService.extract_ticker_from_details(details)
            is_cash = txn.type.lower() in ['deposit', 'withdrawal']
            
            txn_type_lower = txn.type.lower()
            if 'open position' in txn_type_lower or 'buy' in txn_type_lower:
                generic_type = 'buy'
            elif 'close position' in txn_type_lower or 'sell' in txn_type_lower:
                generic_type = 'sell'
            elif 'dividend' in txn_type_lower:
                generic_type = 'dividend'
            elif 'deposit' in txn_type_lower:
                generic_type = 'deposit'
            elif 'withdraw' in txn_type_lower:
                generic_type = 'withdrawal'
            elif 'fee' in txn_type_lower:
                generic_type = 'fee'
            else:
                generic_type = 'other'
            
            if is_cash and not ticker:
                ticker = 'USD' 
            
            # For simplified import, we might need the currency from summary
            currency = summary_data.get('currency', 'USD')

            generic_txn = GenericTransaction({
                'date': txn.date,
                'type': generic_type,
                'ticker': ticker,
                'asset_name': details,
                'quantity': txn.units if not is_cash else txn.amount,
                'price': txn.amount / txn.units if txn.units != 0 else (1.0 if is_cash else 0),
                'amount': txn.amount,
                'currency': currency,
                'fee': 0,
                'notes': f"Position ID: {txn.position_id}" if txn.position_id else "",
                'raw_data': txn.to_dict(),
            })
            generic_transactions.append(generic_txn)
        
        return generic_transactions, summary_data


class InteractiveBrokersParser(BrokerParser):
    """Parser for Interactive Brokers exports."""
    
    def parse(self, content: bytes, filename: str) -> Tuple[List[GenericTransaction], Dict[str, Any]]:
        # TODO: Implement IBKR parser
        logger.warning("Interactive Brokers parser not yet implemented")
        return [], {}


class DegiroParser(BrokerParser):
    """Parser for Degiro exports."""
    
    def parse(self, content: bytes, filename: str) -> List[GenericTransaction]:
        # TODO: Implement Degiro parser
        logger.warning("Degiro parser not yet implemented")
        return []


class BinanceParser(BrokerParser):
    """Parser for Binance exports."""
    
    def parse(self, content: bytes, filename: str) -> List[GenericTransaction]:
        # TODO: Implement Binance parser
        logger.warning("Binance parser not yet implemented")
        return []


class BrokerImportService:
    """Main service for importing broker/exchange files."""
    
    # Registry of parsers
    PARSERS = {
        BrokerType.ETORO: EToroParser(),
        BrokerType.INTERACTIVE_BROKERS: InteractiveBrokersParser(),
        BrokerType.DEGIRO: DegiroParser(),
        BrokerType.BINANCE: BinanceParser(),
    }
    
    @staticmethod
    def detect_broker(content: bytes, filename: str = "") -> BrokerType:
        """Detect broker type from file content."""
        return BrokerDetector.detect(content, filename)
    
    @staticmethod
    def parse_file(
        content: bytes,
        broker_type: Optional[BrokerType] = None,
        filename: str = ""
    ) -> Tuple[BrokerType, List[GenericTransaction], Dict[str, Any]]:
        """
        Parse broker file and return generic transactions.
        
        Args:
            content: File content (bytes)
            broker_type: Optional broker type (auto-detected if None)
            filename: Original filename for detection hints
            
        Returns:
            Tuple of (detected_broker_type, transactions)
        """
        # Auto-detect if not specified
        if broker_type is None:
            broker_type = BrokerImportService.detect_broker(content, filename)
        
        # Get appropriate parser
        parser = BrokerImportService.PARSERS.get(broker_type)
        
        if parser is None:
            raise ValueError(f"No parser available for broker type: {broker_type}")
        
        # Parse transactions
        transactions, summary_data = parser.parse(content, filename)
        
        logger.info(
            f"Parsed {len(transactions)} transactions from {broker_type} file"
        )
        
        return broker_type, transactions, summary_data
    
    @staticmethod
    def generate_summary(
        transactions: List[GenericTransaction],
        broker_type: BrokerType
    ) -> Dict[str, Any]:
        """Generate import summary from generic transactions."""
        
        # Categorize transactions
        categorized = {
            'buy': [],
            'sell': [],
            'dividend': [],
            'deposit': [],
            'withdrawal': [],
            'fee': [],
            'other': []
        }
        
        for txn in transactions:
            category = txn.type if txn.type in categorized else 'other'
            categorized[category].append(txn)
        
        # Extract unique security tickers (excluding currencies)
        CURRENCIES = {'USD', 'EUR', 'GBP', 'CHF', 'JPY', 'AUD', 'CAD'}
        tickers = set()
        for txn in categorized['buy'] + categorized['sell'] + categorized['dividend']:
            if txn.ticker and txn.ticker.upper() not in CURRENCIES:
                tickers.add(txn.ticker)
        
        # Calculate totals
        total_deposits = sum(txn.amount for txn in categorized['deposit'])
        total_withdrawals = sum(abs(txn.amount) for txn in categorized['withdrawal'])
        total_dividends = sum(txn.amount for txn in categorized['dividend'])
        total_fees = sum(abs(txn.amount) for txn in categorized['fee'])
        
        # Get date range
        dates = [txn.date for txn in transactions if txn.date]
        date_range = {
            'start': min(dates).isoformat() if dates else None,
            'end': max(dates).isoformat() if dates else None,
        }
        
        return {
            'broker': broker_type.value,
            'total_transactions': len(transactions),
            'buys': len(categorized['buy']),
            'sells': len(categorized['sell']),
            'dividends': len(categorized['dividend']),
            'deposits': len(categorized['deposit']),
            'withdrawals': len(categorized['withdrawal']),
            'fees': len(categorized['fee']),
            'other': len(categorized['other']),
            'unique_assets': len(tickers),
            'asset_tickers': sorted(list(tickers)),
            'total_deposited': float(total_deposits),
            'total_withdrawn': float(total_withdrawals),
            'total_dividends': float(total_dividends),
            'total_fees': float(total_fees),
            'date_range': date_range,
        }

    @staticmethod
    def _apply_import_rules(
        transactions: List[GenericTransaction],
        skip_closed: bool,
        simplified: bool
    ) -> List[GenericTransaction]:
        """Apply skip_closed_positions and simplified_import rules to a list of transactions."""
        # 1. Calculate net quantities (needed for both rules)
        net_quantities = {}
        active_tickers = set()
        
        # We need a copy because we might modify the list
        working_txn = transactions.copy()

        for txn in working_txn:
            if txn.ticker and txn.type in ['buy', 'sell', 'dividend']:
                change = 0
                if txn.type == 'buy':
                    change = txn.quantity
                elif txn.type == 'sell':
                    change = -abs(txn.quantity)
                net_quantities[txn.ticker] = net_quantities.get(txn.ticker, 0) + change
        
        # Determine which tickers are active
        for ticker, qty in net_quantities.items():
            if abs(qty) > 1e-8:
                active_tickers.add(ticker)

        # 2. Handle Simplified Import
        if simplified:
            simplified_txns = []
            valid_dates = [t.date for t in working_txn if t.date]
            latest_date = max(valid_dates) if valid_dates else datetime.now()
            
            for ticker in active_tickers:
                orig_txn = next((t for t in working_txn if t.ticker == ticker), None)
                if not orig_txn:
                    continue
                
                # For simplified, user said "Use Deposits for Price per unit" 
                # This usually means the total cost basis. 
                # We calculate net invested amount for this ticker.
                total_invested = sum(t.amount for t in working_txn if t.ticker == ticker and t.type in ['buy', 'sell'])
                qty = net_quantities[ticker]
                price = total_invested / qty if qty != 0 else 0

                simplified_txns.append(GenericTransaction({
                    'date': latest_date,
                    'type': 'buy',
                    'ticker': ticker,
                    'asset_name': orig_txn.asset_name,
                    'quantity': qty,
                    'price': price,
                    'amount': total_invested,
                    'currency': orig_txn.currency or 'USD',
                    'fee': 0,
                    'notes': "Simplified Import (Current Balance)",
                    'raw_data': {}
                }))
            
            # Keep cash movements (deposits, withdrawals, fees)
            for txn in working_txn:
                if txn.type in ['deposit', 'withdrawal', 'fee']:
                    simplified_txns.append(txn)
            
            return simplified_txns

        # 3. Handle Skip Closed Positions (if not simplified)
        if skip_closed:
            filtered_txns = []
            CURRENCIES = {'USD', 'EUR', 'GBP', 'CHF', 'JPY', 'AUD', 'CAD'}
            for txn in working_txn:
                # If it's a security trade and the ticker is not active, skip
                if txn.ticker and txn.ticker not in active_tickers and txn.ticker.upper() not in CURRENCIES:
                    # But only if it's not a dividend or other important non-trade row? 
                    # Actually skip_closed means don't show the asset if it's 0.
                    continue
                filtered_txns.append(txn)
            return filtered_txns

        return working_txn

    async def import_transactions(
        self,
        db: Any,
        user_id: int,
        content: bytes,
        broker_type: Optional[BrokerType] = None,
        filename: str = "",
        skip_closed_positions: bool = False,
        simplified_import: bool = False
    ) -> Dict[str, Any]:
        """
        Import transactions from file directly into the database.
        
        This handles asset creation, deduplication, and transaction recording.
        """
        from app import crud, schemas, models
        from sqlalchemy import select
        
        # 1. Parse file
        detected_broker, transactions, summary_data = self.parse_file(content, broker_type, filename)
        
        if not transactions:
            return {"imported": 0, "skipped": 0, "assets_created": 0}
            
        # 2. Get or create Custodian
        custodian_name = detected_broker.value.replace('_', ' ').title()
        stmt = select(models.Custodian).where(
            models.Custodian.user_id == user_id,
            models.Custodian.name.ilike(custodian_name)
        )
        result = await db.execute(stmt)
        custodian = result.scalars().first()
        
        if not custodian:
            custodian = await crud.create_custodian(
                db, 
                schemas.CustodianCreate(
                    name=custodian_name, 
                    type=schemas.CustodianType.BROKER
                ),
                user_id,
                commit=False # Don't commit yet
            )
        
        custodian_id = custodian.id
            
        # 3. Get Asset Types (pre-fetch IDs to avoid lazy loading after commit)
        asset_types = await crud.get_asset_types(db, user_id)
        # Store a mapping to avoid accessing expired objects in the loop
        # Format: {name_lower: id}
        at_mapping = {at.name.lower(): at.id for at in asset_types}
        default_at_id = asset_types[0].id if asset_types else None

        # Helper to find or use default asset type id
        def get_asset_type_id(category_name="Financial", force_type: str = None):
            # Priority: Exchange, Stock, Crypto, Cash
            if force_type and force_type.lower() in at_mapping:
                return at_mapping[force_type.lower()]

            if category_name == "Financial":
                if "exchange" in at_mapping:
                    return at_mapping["exchange"]
                if "equity" in at_mapping:
                    return at_mapping["equity"]
                if "stock" in at_mapping:
                    return at_mapping["stock"]
            if category_name == "Alternative" and "crypto" in at_mapping:
                return at_mapping["crypto"]
            if category_name == "Cash" and "cash" in at_mapping:
                return at_mapping["cash"]
            return default_at_id

        # SPECIAL LOGIC: Simplified Import Aggregation for "Exchange" type
        if simplified_import and detected_broker == BrokerType.ETORO and "exchange" in at_mapping:
            # 1. Calculate Metrics
            total_deposits = sum(t.amount for t in transactions if t.type == 'deposit')
            total_withdrawals = sum(abs(t.amount) for t in transactions if t.type == 'withdrawal')
            net_deposits = total_deposits - total_withdrawals
            
            # Construct ONE single transaction to represent the account creation
            latest_date = max((t.date for t in transactions), default=datetime.utcnow())
            
            portfolio_txn = GenericTransaction({
                'date': latest_date,
                'type': 'buy', # Initial "Buy" of the account asset
                'ticker': '', # No ticker for Exchange type
                'asset_name': f"{custodian_name} Portfolio",
                'quantity': 1,
                'price': net_deposits, # Cost Basis = Net Deposits
                'amount': net_deposits,
                'currency': summary_data.get('currency', 'USD'),
                'fee': 0,
                'notes': "Simplified Account Import (Cost Basis = Net Deposits)"
            })
            
            # Replace the list with just this one
            transactions = [portfolio_txn]
            
        else:
            # 4. Process Transactions
            # Apply import rules (filter/transform)
            transactions = self._apply_import_rules(
                transactions, 
                skip_closed_positions, 
                simplified_import
            )
        
        # Calculate active tickers for the skip logic in the loop
        net_quantities = {}
        active_tickers = set()
        for txn in transactions:
            if txn.ticker and txn.type in ['buy', 'sell', 'dividend']:
                change = 0
                if txn.type == 'buy':
                    change = txn.quantity
                elif txn.type == 'sell':
                    change = -abs(txn.quantity)
                net_quantities[txn.ticker] = net_quantities.get(txn.ticker, 0) + change
        
        for ticker, qty in net_quantities.items():
            if abs(qty) > 1e-8:
                active_tickers.add(ticker)

        imported_count = 0
        skipped_count = 0
        assets_created = 0
        
        # Track assets created/found in this session to avoid redundant queries
        # Pre-fetch ALL existing assets for this custodian to avoid N+1 queries
        stmt = select(models.Asset).where(
            models.Asset.user_id == user_id,
            models.Asset.custodian_id == custodian_id
        )
        result = await db.execute(stmt)
        existing_assets = result.scalars().all()
        
        # Map ticker -> asset_id
        asset_cache = {a.ticker_symbol: a.id for a in existing_assets if a.ticker_symbol}
        
        # We need to sort transactions by date to ensure proper order
        transactions.sort(key=lambda x: x.date if x.date else datetime.min)
        
        for gentxn in transactions:
            # Skip rows without date or type
            if not gentxn.date or not gentxn.type:
                skipped_count += 1
                continue
                
            # Handle Buy/Sell/Dividend/Deposit/Withdrawal
            if gentxn.type in ['buy', 'sell', 'dividend', 'deposit', 'withdrawal']:
                ticker = gentxn.ticker # Can be None/Empty
                
                # If skipping closed positions, check if this ticker should be ignored
                if skip_closed_positions and ticker and ticker != "UNKNOWN" and ticker not in active_tickers:
                    # Only skip if we DON'T already have this asset in the DB.
                    # If we already have it, we MUST import the transactions to bring the balance to 0.
                    if ticker not in asset_cache:
                        # Only skip if it's a security trade. We might still want the cash movement.
                        CURRENCIES = {'USD', 'EUR', 'GBP', 'CHF', 'JPY', 'AUD', 'CAD'}
                        if ticker.upper() not in CURRENCIES:
                            skipped_count += 1
                            continue
                
                # Check if this is a cash movement or a security trade
                CURRENCIES = {'USD', 'EUR', 'GBP', 'CHF', 'JPY', 'AUD', 'CAD'}
                is_cash_asset = ticker.upper() in CURRENCIES
                
                asset_name = gentxn.asset_name or ticker
                if asset_name in ['-', '', None]:
                    asset_name = ticker if (ticker and ticker != "UNKNOWN") else f"Broker {gentxn.type.capitalize()}"
                
                if is_cash_asset:
                    asset_name = f"{custodian_name} ({ticker} Cash)"
                
                asset_id = asset_cache.get(ticker)
                if not asset_id:
                    # Create new asset (Security or Cash Account)
                    asset_type_id = get_asset_type_id("Financial" if not is_cash_asset else "Cash")
                    asset = await crud.create_asset(
                        db,
                        schemas.AssetCreate(
                            name=asset_name,
                            ticker_symbol=ticker,
                            custodian_id=custodian_id,
                            asset_type_id=asset_type_id,
                            quantity=0,
                            currency=gentxn.currency or 'USD'
                        ),
                        user_id,
                        commit=False
                    )
                    assets_created += 1
                    asset_id = asset.id
                    asset_cache[ticker] = asset_id
                
                # Check for duplicates using asset_id and date
                # For cash movements, we also include the amount in duplicate check to be safe
                stmt = select(models.Transaction).where(
                    models.Transaction.asset_id == asset_id,
                    models.Transaction.date == gentxn.date
                )
                
                if gentxn.notes:
                    stmt = stmt.where(models.Transaction.notes == gentxn.notes)
                elif is_cash_asset:
                    # For cash without position ID, use amount to deduplicate
                    stmt = stmt.where(models.Transaction.quantity_change == gentxn.quantity)
                
                result = await db.execute(stmt)
                if result.scalar_one_or_none():
                    skipped_count += 1
                    continue
                
                # Map Generic Type to TransactionType
                txn_type = models.TransactionType.BUY
                quantity_change = gentxn.quantity
                
                if gentxn.type == 'sell':
                    txn_type = models.TransactionType.SELL
                    quantity_change = -abs(gentxn.quantity)
                elif gentxn.type == 'dividend':
                    txn_type = models.TransactionType.DIVIDEND
                    quantity_change = 0 
                elif gentxn.type == 'deposit':
                    txn_type = models.TransactionType.TRANSFER_IN
                    quantity_change = abs(gentxn.quantity)
                elif gentxn.type == 'withdrawal':
                    txn_type = models.TransactionType.TRANSFER_OUT
                    quantity_change = -abs(gentxn.quantity)
                    
                try:
                    await crud.create_transaction(
                        db,
                        schemas.TransactionCreate(
                            asset_id=asset_id,
                            type=txn_type,
                            date=gentxn.date,
                            quantity_change=quantity_change,
                            price_per_unit=gentxn.price,
                            fees=gentxn.fee,
                            notes=gentxn.notes
                        ),
                        user_id,
                        commit=False
                    )
                    
                    # If simplified import, also add a PriceHistory entry (Valuation) for this date
                    if simplified_import and not is_cash_asset and gentxn.price > 0:
                        # Price per unit represents the cost basis in simplified, 
                        # but we also want to record the "current valuation" if available.
                        # For eToro, we can't easily get the *market price* per ticker from summary yet, 
                        # so we use the calculated price or a default.
                        await crud.create_price_history(
                            db,
                            schemas.PriceHistoryCreate(
                                asset_id=asset_id,
                                price=gentxn.price,
                                date=gentxn.date
                            ),
                            user_id,
                            commit=False
                        )

                    imported_count += 1
                except Exception as e:
                    logger.error(f"Failed to import transaction: {e}")
                    skipped_count += 1
            else:
                # Other types (deposit, withdrawal, fee)
                # For now, we mainly focus on buys/sells/dividends which affect asset values
                # Deposits/Withdrawals could be handled if we had a "Cash" asset
                skipped_count += 1
        
        # Finally, commit everything
        try:
            await db.commit()
        except Exception as e:
            logger.error(f"Failed to commit batch import: {e}")
            await db.rollback()
            raise
                
        return {
            "imported": imported_count,
            "skipped": skipped_count,
            "assets_created": assets_created,
            "broker": detected_broker.value
        }


# Singleton instance
broker_import_service = BrokerImportService()
