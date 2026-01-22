"""
eToro CSV Import Service

Handles parsing and importing transaction data from eToro CSV exports.
eToro provides account statements in CSV format that include:
- Trades (buy/sell)
- Dividends
- Deposits/Withdrawals
- Fees

CSV Format (typical eToro export):
Date,Type,Details,Amount,Units,Realized Equity Change,Realized Equity,Balance,Position ID,Asset type,NWA
"""

import csv
import io
from datetime import datetime
from decimal import Decimal
from typing import List, Dict, Any, Optional, Tuple
import logging
import pandas as pd
import pdfplumber

logger = logging.getLogger(__name__)


class EToroTransaction:
    """Represents a single eToro transaction."""
    
    def __init__(self, row: Dict[str, Any]):
        # normalize keys (some formats might have different casing)
        self.row_data = {str(k).strip().lower(): v for k, v in row.items()}
        
        self.date = self._parse_date(self.row_data.get('date', ''))
        self.type = str(self.row_data.get('type', '')).strip()
        self.details = str(self.row_data.get('details', '')).strip()
        self.amount = self._parse_decimal(self.row_data.get('amount', '0'))
        self.units = self._parse_decimal(self.row_data.get('units', '0'))
        self.realized_equity_change = self._parse_decimal(self.row_data.get('realized equity change', '0'))
        self.realized_equity = self._parse_decimal(self.row_data.get('realized equity', '0'))
        self.balance = self._parse_decimal(self.row_data.get('balance', '0'))
        self.position_id = str(self.row_data.get('position id', '')).strip()
        self.asset_type = str(self.row_data.get('asset type', '')).strip()
        self.nwa = str(self.row_data.get('nwa', '')).strip()
        
    def _parse_date(self, value: Any) -> Optional[datetime]:
        """Parse eToro date format."""
        if not value or pd.isna(value):
            return None
            
        if isinstance(value, datetime):
            return value
            
        date_str = str(value).strip()
        
        # Try multiple date formats
        formats = [
            '%d/%m/%Y %H:%M:%S',
            '%d/%m/%Y %H:%M',
            '%d/%m/%Y',
            '%Y-%m-%d %H:%M:%S',
            '%Y-%m-%d',
        ]
        
        for fmt in formats:
            try:
                return datetime.strptime(date_str, fmt)
            except ValueError:
                continue
        
        logger.warning(f"Could not parse date: {date_str}")
        return None
    
    def _parse_decimal(self, value: Any) -> Decimal:
        """Parse decimal value, handling currency symbols and formatting."""
        if value is None or pd.isna(value):
            return Decimal('0')
            
        if isinstance(value, (int, float, Decimal)):
            return Decimal(str(value))
        
        # Remove currency symbols, spaces, and commas
        cleaned = str(value).replace('$', '').replace('€', '').replace('£', '')
        cleaned = cleaned.replace(',', '').replace(' ', '').strip()
        
        try:
            return Decimal(cleaned)
        except Exception:
            logger.warning(f"Could not parse decimal: {value}")
            return Decimal('0')
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for API response."""
        return {
            'date': self.date.isoformat() if self.date else None,
            'type': self.type,
            'details': self.details,
            'amount': float(self.amount),
            'units': float(self.units),
            'realized_equity_change': float(self.realized_equity_change),
            'realized_equity': float(self.realized_equity),
            'balance': float(self.balance),
            'position_id': self.position_id,
            'asset_type': self.asset_type,
            'nwa': self.nwa,
        }


class EToroImportService:
    """Service for importing eToro account statements (CSV, XLSX, PDF)."""
    
    @staticmethod
    def parse_file(content: bytes, filename: str) -> Tuple[List[EToroTransaction], Dict[str, Any]]:
        """Parse eToro file based on extension."""
        ext = filename.lower().split('.')[-1]
        
        summary_data = {}
        if ext == 'csv':
            return EToroImportService.parse_csv(content.decode('utf-8')), summary_data
        elif ext in ['xlsx', 'xls']:
            return EToroImportService.parse_xlsx(content)
        elif ext == 'pdf':
            return EToroImportService.parse_pdf(content)
        else:
            raise ValueError(f"Unsupported file extension for eToro: {ext}")

    @staticmethod
    def parse_csv(csv_content: str) -> List[EToroTransaction]:
        """Parse eToro CSV content."""
        transactions = []
        try:
            csv_file = io.StringIO(csv_content)
            reader = csv.DictReader(csv_file)
            for row in reader:
                try:
                    transactions.append(EToroTransaction(row))
                except Exception as e:
                    logger.error(f"Error parsing CSV row: {e}")
            return transactions
        except Exception as e:
            logger.error(f"Error parsing eToro CSV: {e}")
            raise ValueError(f"Invalid eToro CSV format: {str(e)}")

    @staticmethod
    def parse_xlsx(content: bytes) -> Tuple[List[EToroTransaction], Dict[str, Any]]:
        """Parse eToro XLSX content."""
        transactions = []
        summary_data = {}
        try:
            xl = pd.ExcelFile(io.BytesIO(content))
            
            # 1. Parse Account Activity (Transactions)
            # eToro usually puts transactions in 'Account Activity'
            sheet_name = 'Account Activity' if 'Account Activity' in xl.sheet_names else xl.sheet_names[0]
            
            # Read first few rows to find the header
            df_preview = pd.read_excel(xl, sheet_name=sheet_name, header=None, nrows=20)
            
            header_row_idx = None
            for idx, row in df_preview.iterrows():
                # Check if this row contains 'Date' and 'Type' - characteristic of the transactions table
                row_values = [str(val).strip().lower() for val in row.values if val is not None]
                if 'date' in row_values and ('type' in row_values or 'details' in row_values):
                    header_row_idx = idx
                    break
            
            if header_row_idx is not None:
                # Re-read the full sheet starting from the header row
                data_df = pd.read_excel(xl, sheet_name=sheet_name, skiprows=header_row_idx)
                
                # Cleanup column names
                data_df.columns = [str(c).strip() for c in data_df.columns]
                
                for _, row in data_df.iterrows():
                    # Skip empty rows or the footer
                    if pd.isna(row.get('Date')) and pd.isna(row.get('Type')):
                        continue
                    try:
                        transactions.append(EToroTransaction(row.to_dict()))
                    except Exception as e:
                        logger.error(f"Error parsing XLSX row: {e}")

            # 2. Parse Account Summary (Portfolio Snapshot)
            if 'Account Summary' in xl.sheet_names:
                summary_df = pd.read_excel(xl, sheet_name='Account Summary', header=None)
                for idx, row in summary_df.iterrows():
                    row_vals = [str(v).strip() for v in row.values if v is not None]
                    row_str = " ".join(row_vals).lower()
                    
                    if 'currency' in row_str:
                        # Find the first 3-letter uppercase word (likely the currency)
                        import re
                        for val in row_vals:
                            if re.match(r'^[A-Z]{3}$', val):
                                if val not in ['ZEUR', 'ZUSD']: # Filter out generic labels if any
                                    summary_data['currency'] = val
                                    break
            
            if not transactions:
                if len(xl.sheet_names) > 1:
                    # If we still have 0 transactions, maybe they are in the first sheet and we missed it?
                    # This is a fallback
                    pass

            return transactions, summary_data
        except Exception as e:
            logger.error(f"Error parsing eToro XLSX: {e}")
            raise ValueError(f"Invalid eToro XLSX format: {str(e)}")

    @staticmethod
    def parse_pdf(content: bytes) -> Tuple[List[EToroTransaction], Dict[str, Any]]:
        """Parse eToro PDF content."""
        transactions = []
        summary_data = {}
        try:
            with pdfplumber.open(io.BytesIO(content)) as pdf:
                all_rows = []
                headers = []
                
                # Keywords to identify the transaction table
                REQUIRED_HEADERS = {'date', 'type', 'amount'}
                
                for page in pdf.pages:
                    # Extract tables with some tolerance
                    tables = page.extract_tables()
                    
                    for table in tables:
                        if not table:
                            continue
                        
                        # Check content of the table
                        # If we haven't found headers yet, look for them
                        if not headers:
                            for i, row in enumerate(table):
                                # Normalize row to find headers
                                row_str = [str(val).strip().lower() for val in row if val]
                                
                                # Check if this row looks like a header row
                                if REQUIRED_HEADERS.issubset(set(row_str)) or \
                                   ('date' in row_str and 'details' in row_str):
                                    headers = [str(val).strip() for val in row if val]
                                    # Add subsequent rows
                                    all_rows.extend(table[i+1:])
                                    break
                                
                            # If we still didn't find headers, maybe this is the Summary table?
                            # Check for "Currency" in the first column or so
                            if not headers:
                                for row in table:
                                    row_clean = [str(v).strip() for v in row if v]
                                    row_text = " ".join(row_clean).lower()
                                    if 'currency' in row_text:
                                        # Look for 3-letter uppercase code
                                        for val in row_clean:
                                            import re
                                            if re.match(r'^[A-Z]{3}$', val) and val not in ['ZEUR', 'ZUSD']: # Filter out generic labels if any
                                                summary_data['currency'] = val
                        else:
                            # We already have headers, so assume subsequent tables in the doc 
                            # (or at least valid looking ones) are continuations
                            # Simple validation: checks if row length is roughly same
                            for row in table:
                                # Skip header repetition if any
                                row_clean = [str(val).strip().lower() for val in row if val]
                                if 'date' in row_clean and 'type' in row_clean:
                                    continue
                                try:
                                    # Some PDFs have weird spacing
                                    clean_line = " ".join([str(x) for x in row if x is not None]).strip()
                                    
                                    # Check for headers to identify sections
                                    if 'Position ID' in clean_line and 'Action' in clean_line:
                                        # This row looks like a header, skip it if we're already processing data
                                        continue
                                    elif 'Name' in clean_line and 'Date' in clean_line and 'Type' in clean_line:
                                        # This row looks like a header, skip it if we're already processing data
                                        continue
                                except Exception: # Changed bare except to except Exception
                                    continue
                                all_rows.extend([row])

                if headers:
                    # Normalize headers to match EToroTransaction expectation
                    # eToro PDF headers might be "Position ID", "Amount", etc.
                    # We map them to the keys expected by EToroTransaction
                    
                    for row in all_rows:
                        # Clean and map to row dict
                        # Handle row length mismatch by padding or truncating
                        if not row:
                            continue

                        # Filter out rows that are just page numbers or garbage
                        if len(row) < 3:
                            continue

                        row_dict = {}
                        for i, h in enumerate(headers):
                            if i < len(row):
                                row_dict[h] = row[i]
                        
                        # specific fix: PDF sometimes reads 'Amount' as just the number without currency, or with
                        # We just pass it to EToroTransaction which cleans it
                        try:
                            # Skip rows that don't look like transactions (e.g. subtotals)
                            if 'Total' in str(row_dict.get('Date', '')):
                                continue
                                
                            transactions.append(EToroTransaction(row_dict))
                        except Exception:
                            # logger.debug(f"Skipping PDF row: {e}")
                            pass
                
            return transactions, summary_data
        except Exception as e:
            logger.error(f"Error parsing eToro PDF: {e}")
            raise ValueError(f"Invalid eToro PDF format: {str(e)}")
    
    @staticmethod
    def categorize_transactions(transactions: List[EToroTransaction]) -> Dict[str, List[EToroTransaction]]:
        """
        Categorize transactions by type for easier processing.
        
        Returns:
            Dictionary with keys: 'trades', 'dividends', 'deposits', 'withdrawals', 'fees', 'other'
        """
        categorized = {
            'trades': [],
            'dividends': [],
            'deposits': [],
            'withdrawals': [],
            'fees': [],
            'other': []
        }
        
        for txn in transactions:
            txn_type = txn.type.lower()
            
            if 'open position' in txn_type or 'close position' in txn_type or 'buy' in txn_type or 'sell' in txn_type:
                categorized['trades'].append(txn)
            elif 'dividend' in txn_type:
                categorized['dividends'].append(txn)
            elif 'deposit' in txn_type:
                categorized['deposits'].append(txn)
            elif 'withdraw' in txn_type:
                categorized['withdrawals'].append(txn)
            elif 'fee' in txn_type or 'commission' in txn_type:
                categorized['fees'].append(txn)
            else:
                categorized['other'].append(txn)
        
        return categorized
    
    @staticmethod
    def extract_ticker_from_details(details: str) -> Optional[str]:
        """
        Extract ticker symbol from transaction details.
        
        eToro details format examples:
        - "Apple Inc. (AAPL)"
        - "Bitcoin (BTC)"
        - "AAPL/USD"
        """
        if not details:
            return None
        
        # Try to extract from parentheses
        if '(' in details and ')' in details:
            start = details.rfind('(')
            end = details.rfind(')')
            if start < end:
                ticker = details[start+1:end].strip()
                # Remove /USD or other currency pairs
                if '/' in ticker:
                    ticker = ticker.split('/')[0]
                return ticker.upper()
        
        # Try to extract from slash notation
        if '/' in details:
            ticker = details.split('/')[0].strip()
            return ticker.upper()
        
        return None
    
    @staticmethod
    def generate_import_summary(transactions: List[EToroTransaction]) -> Dict[str, Any]:
        """
        Generate a summary of the import for user review.
        
        Returns:
            Dictionary with summary statistics
        """
        categorized = EToroImportService.categorize_transactions(transactions)
        
        # Extract unique tickers
        tickers = set()
        for txn in categorized['trades']:
            ticker = EToroImportService.extract_ticker_from_details(txn.details)
            if ticker:
                tickers.add(ticker)
        
        # Calculate totals
        total_deposits = sum(txn.amount for txn in categorized['deposits'])
        total_withdrawals = sum(abs(txn.amount) for txn in categorized['withdrawals'])
        total_dividends = sum(txn.amount for txn in categorized['dividends'])
        total_fees = sum(abs(txn.amount) for txn in categorized['fees'])
        
        return {
            'total_transactions': len(transactions),
            'trades': len(categorized['trades']),
            'dividends': len(categorized['dividends']),
            'deposits': len(categorized['deposits']),
            'withdrawals': len(categorized['withdrawals']),
            'fees': len(categorized['fees']),
            'other': len(categorized['other']),
            'unique_assets': len(tickers),
            'asset_tickers': sorted(list(tickers)),
            'total_deposited': float(total_deposits),
            'total_withdrawn': float(total_withdrawals),
            'total_dividends': float(total_dividends),
            'total_fees': float(total_fees),
            'date_range': {
                'start': min(txn.date for txn in transactions if txn.date).isoformat() if transactions else None,
                'end': max(txn.date for txn in transactions if txn.date).isoformat() if transactions else None,
            }
        }


# Singleton instance
etoro_import_service = EToroImportService()
