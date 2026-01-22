# Development Scripts

This directory contains one-off utility scripts used during development, debugging, and data migration. These scripts are tracked in the private repository but excluded from the public release.

## Categories

### Testing & Verification
- `test_api_settings.py` - Test API settings endpoint
- `test_api_update.py` - Test API update functionality
- `test_passlib.py` - Test password hashing
- `reverify_endpoints.py` - Verify API endpoint security
- `verify_logic.py` - Verify business logic

### Debugging
- `debug_agents.py` - Debug background agents
- `debug_assets.py` - Debug asset data
- `debug_md.py` - Debug market data
- `debug_settings.py` - Debug settings

### Data Management
- `migrate_data.py` - Migrate data between users
- `fix_crypto_assets.py` - Fix cryptocurrency asset data
- `fix_data.py` - General data fixes
- `delete_bad_btc.py` - Remove corrupted BTC data
- `inspect_btc_data.py` - Inspect Bitcoin data

### Utilities
- `check_prices.py` - Check price fetching
- `check_settings.py` - Check settings configuration
- `seed_prices.py` - Seed initial price data

## Usage

These scripts are meant to be run directly from the backend directory:

```bash
cd backend
source venv/bin/activate
python scripts/script_name.py
```

## Note

These scripts may contain hardcoded values, test credentials, or personal identifiers. They are excluded from the public repository via the publish script.
