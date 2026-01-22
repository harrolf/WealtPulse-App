# Quick Start Guide 🚀

WealthPulse is designed to be up and running in minutes. Choose the path that fits your environment.

---

## 🏎️ Path 1: Proxmox LXC (Recommended)
This is the fastest path. It creates a dedicated container, configures the database, and sets up Nginx/SSL-ready hosting automatically.

Run this command on your Proxmox Host:
```bash
bash <(curl -s https://raw.githubusercontent.com/harrolf/WealthPulse-App/master/install/install_proxmox.sh?v=$(date +%s))
```
*The script will automatically handle database creation and security key generation.*

---

## 🐳 Path 2: Docker Compose
Perfect for users with an existing Docker environment.

1. **Clone & Start**:
   ```bash
   git clone https://github.com/harrolf/WealthPulse-App.git
   cd WealthPulse
   docker-compose up -d
   ```
2. **Access**:
   - Frontend: http://localhost:3000
   - Backend API: http://localhost:8000

---

## 🛠️ Path 3: Local Development Setup
Use this for contributing or running directly on your machine.

### 1. Backend
```bash
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
alembic upgrade head
python -m app.seed
uvicorn app.main:app --reload
```

### 2. Frontend
```bash
cd frontend
npm install
npm run dev
```

---

## 🏁 First Steps After Install

1. **Register**: The first account is your primary account.
2. **Create a Custodian**: Go to Settings/Administration or use the API to add your first Broker or Exchange.
3. **Add Assets**: Use the "+" button on the Dashboard to start tracking.
4. **Secure**: If in production, ensure you have set unique keys in `.env` as described in the **[README Security Section](README.md#manual-security-key-generation)**.

---

## 🆘 Troubleshooting

| Issue | Resolution |
|-------|------------|
| `ValidationError: SECRET_KEY` | You are using default keys. Update your `.env` file with random strings. |
| Port 3000 busy | Change `VITE_PORT` in `frontend/.env`. |
| Prices not loading | Ensure the server has internet access to reach Yahoo Finance. |

**For full technical documentation, architecture details, and configuration reference, see the [Main README](./README.md).**
