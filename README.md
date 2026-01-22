# WealthPulse 💰

A modern, self-hosted personal wealth management application for tracking your complete financial portfolio across multiple asset types and custodians.

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Python](https://img.shields.io/badge/python-3.11+-blue.svg)
![React](https://img.shields.io/badge/react-19-blue.svg)
![Version](https://img.shields.io/badge/version-v1.5.7-green.svg)

## ✨ Overview

WealthPulse is designed for users who want complete control over their financial data. It provides a professional-grade dashboard to monitor net worth, track diverse asset classes (stocks, crypto, real estate, collectibles), and visualize portfolio performance without relying on third-party aggregators that compromise privacy.

---

### 🚀 Get Started Immediately
If you are looking to install WealthPulse for the first time, please refer to the **[Quick Start Guide](./QUICKSTART.md)** for:
- One-liner Proxmox LXC Installation
- Docker Compose Setup
- Manual Development Setup

---

## 💎 Features

### Portfolio Management
- 📊 **Multi-Currency Net Worth** - View your total wealth in USD, EUR, CHF, and more.
- 💼 **Asset Tracking** - Manage stocks, crypto, real estate, and 15+ asset types.
- 🏦 **Custodian Management** - Track assets across multiple brokers and banks.
- 🏷️ **Groups & Tags** - Organize assets with custom primary groups and flexible tagging.
- 🔍 **Search & Filter** - Quickly find assets with real-time search and favorites.

### Real-Time Data & Intelligence
- 📈 **Automated Pricing** - Automatic hourly price fetching via Yahoo Finance integration.
- 🔄 **Live Valuation** - Real-time portfolio value calculations including currency conversion.
- 💱 **Exchange Rates** - Seamless handling of multi-currency holdings.

### Secure & Professional UI
- 🎨 **Modern Dark/Light UI** - Premium interface built with Tailwind CSS.
- 📱 **Mobile First** - Fully responsive design for tracking on the go.
- ✅ **Rich Validation** - Smart forms with detailed error feedback.

---

## 🏗️ Architecture

WealthPulse follows a modern decoupled architecture:

### Backend (FastAPI)
- **Framework**: FastAPI (Async)
- **Database**: SQLite (Default) or PostgreSQL (Production)
- **ORM**: SQLAlchemy 2.0 (Async)
- **Data Source**: `yfinance` & exchange rate APIs
- **Security**: JWT-based Auth, CSRF Protection, and PII Encryption

### Frontend (React)
- **Framework**: React 19 + TypeScript
- **State Management**: TanStack Query (React Query)
- **Styling**: Tailwind CSS 4
- **Icons**: Lucide React

---

## ⚙️ Configuration Reference

WealthPulse is configured via environment variables in a `.env` file.

| Variable | Description | Default |
|----------|-------------|---------|
| `ENVIRONMENT` | `development` or `production` | `development` |
| `DATABASE_URL` | SQLAlchemy connection string | `sqlite+aiosqlite:///./data/wealthpulse.db` |
| `SECRET_KEY` | JWT signing key (MIN 32 chars) | *Required* |
| `ENCRYPTION_KEY` | Fernet key for data encryption | *Required* |
| `REFRESH_TOKEN_SECRET` | Separate secret for refresh tokens | *Required* |
| `DECIMAL_PRECISION` | Number of decimal places for assets | `8` |
| `ADMIN_EMAILS` | Comma-separated list of admin users | `harrolf@gmail.com` |

---

## 🔐 Security Deep Dive

### Automated Hardening
The application enforces strict security in `production` mode:
1. **Placeholder Rejection**: Will not start if default security keys are detected.
2. **Database Constraints**: SQLite is forbidden in production; PostgreSQL is required.
3. **CSRF Protection**: Comprehensive protection via `starlette-csrf`.

### Manual Key Generation
If setting up without the automated Proxmox script:
```bash
# Generate SECRET_KEY & REFRESH_TOKEN_SECRET
openssl rand -base64 32

# Generate ENCRYPTION_KEY (Fernet)
python3 -c 'from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())'
```

---

## 🛠️ Administration

### Creating an Admin User
1. Add your email to `ADMIN_EMAILS` in `.env`.
2. Register normally; the system will auto-assign the `is_admin` role.
3. Existing users can be promoted via SQL: `UPDATE users SET is_admin = true WHERE email = '...'`.

---

## 📝 Roadmap
- [x] Multi-user support & Authentication
- [x] Automated Price Fetching
- [x] Groups & Tags
- [ ] Transaction Export/Import (CSV/JSON)
- [ ] Historical Performance Snapshots
- [ ] Custom Asset Categories

## 📄 License
Licensed under the [MIT License](./LICENSE).

**Built with ❤️ for decentralized wealth management.**
