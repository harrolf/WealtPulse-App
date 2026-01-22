# WealthPulse - Proxmox LXC Installation Guide

This guide details how to install and run WealthPulse on a Proxmox LXC container (Linux Container).

## 1. Create LXC Container

In your Proxmox web interface:
1.  **Create CT**:
    *   **Template**: `debian-12-standard` (Bookworm) or `ubuntu-24.04-standard` (Recommended).
    *   **Resources**:
        *   **CPU**: 2 Cores.
        *   **Memory**: 2048 MB (2GB).
        *   **Swap**: 512 MB.
        *   **Disk**: 8 GB minimum.
    *   **Network**: Static IP (recommended) or DHCP.

## ⚡ Quick Install (Automatic)

**Run this command on your Proxmox Host (Shell)** to automatically create a new LXC container and install WealthPulse inside it:

```bash
bash <(curl -s https://raw.githubusercontent.com/harrolf/WealthPulse-App/master/install/install_proxmox.sh)
```

The script will ask for:
1.  **Container ID** (suggests next free ID).
2.  **Hostname** (default: `wealthpulse`).
3.  **Root Password** (for the new container).
4.  **Storage** (e.g., `local-lvm`).

Once finished, it will output the IP address of your new WealthPulse instance.

### Updating / Manual Run
To update an existing installation (or if you created the LXC manually), run the same command inside the LXC console.

*> **Note**: If `curl` is missing (command not found), install it first:*
```bash
apt update && apt install -y curl
```

Then run the installer:
```bash
bash <(curl -s https://raw.githubusercontent.com/harrolf/WealthPulse-App/master/install/install_proxmox.sh)
```

### Troubleshooting
If the installation stops or fails silently, you can run the script in **Verbose Mode** to see detailed logs:

```bash
bash <(curl -s https://raw.githubusercontent.com/harrolf/WealthPulse-App/master/install/install_proxmox.sh) --verbose
```

This will output all system commands to the console instead of hiding them.

---

## Manual Installation

If you prefer to install manually, follow the steps below.

## 2. Initial Setup (Inside LXC)

Log in to your LXC console as `root`.

### Update System & Install Dependencies
```bash
apt update && apt upgrade -y
apt install -y git python3 python3-venv python3-pip curl postgresql postgresql-contrib build-essential
```

### Install Node.js (via NVM or direct)
We need Node.js 18+ for the frontend.
```bash
# Using NodeSource for Debian/Ubuntu
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs
```

Verify versions:
```bash
node -v
python3 --version
psql --version
```

## 3. Clone Repository

```bash
cd /opt
git clone https://github.com/harrolf/WealthPulse-App.git
cd WealthPulse
```

## 4. Backend Setup

### Database Configuration
Set up the PostgreSQL user and database.
```bash
sudo -u postgres psql
```
Inside the `psql` shell:
```sql
CREATE DATABASE wealthpulse;
CREATE USER wealthuser WITH PASSWORD 'secure_password_here';
GRANT ALL PRIVILEGES ON DATABASE wealthpulse TO wealthuser;
\q
```

### Python Environment
```bash
cd /opt/WealthPulse/backend
python3 -m venv venv
source venv/bin/activate

# Install requirements
pip install -r requirements.txt
```

### Environment Variables
Create the `.env` file:
```bash
cp .env.example .env
nano .env
```
Update the `DATABASE_URL`:
```ini
DATABASE_URL=postgresql://wealthuser:secure_password_here@localhost/wealthpulse
ENVIRONMENT=production

# Security - CRITICAL
SECRET_KEY=change-this-to-a-secure-random-string
REFRESH_TOKEN_SECRET=change-this-to-a-different-secure-random-string
ENCRYPTION_KEY=change-this-to-a-valid-fernet-key-32-url-safe-base64-bytes

# CSRF Configuration
CSRF_COOKIE_NAME=wp_csrftoken
CSRF_COOKIE_HTTPONLY=False

# App Logic
DECIMAL_PRECISION=8

# API
API_HOST=0.0.0.0
API_PORT=8000

```

### Run Migrations
Initialize the DB schema:
```bash
alembic upgrade head
```

### Create Systemd Service (Backend)
To run the backend automatically at startup:
```bash
nano /etc/systemd/system/wealthpulse-backend.service
```
Content:
```ini
[Unit]
Description=WealthPulse Backend
After=network.target postgresql.service

[Service]
User=root
WorkingDirectory=/opt/WealthPulse/backend
ExecStart=/opt/WealthPulse/backend/venv/bin/uvicorn app.main:app --host 0.0.0.0 --port 8000
Restart=always

[Install]
WantedBy=multi-user.target
```
Enable and start:
```bash
systemctl daemon-reload
systemctl enable --now wealthpulse-backend
```

## 5. Frontend Setup

### Install & Build
```bash
cd /opt/WealthPulse/frontend
npm install
npm run build
```
The build output will be in `/opt/WealthPulse/frontend/dist`.

### Serve with Nginx (Recommended)
Install Nginx to serve the frontend and proxy API requests.
```bash
apt install -y nginx
```

Create config:
```bash
nano /etc/nginx/sites-available/wealthpulse
```
Content:
```nginx
server {
    listen 80;
    server_name _;

    root /opt/WealthPulse/frontend/dist;
    index index.html;

    # Frontend (SPA)
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Backend API Proxy
    location /api {
        proxy_pass http://localhost:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
    
    # Swagger UI (Optional)
    location /docs {
        proxy_pass http://localhost:8000/docs;
    }
    
    location /openapi.json {
        proxy_pass http://localhost:8000/openapi.json;
    }
}
```

Enable site:
```bash
ln -s /etc/nginx/sites-available/wealthpulse /etc/nginx/sites-enabled/
rm /etc/nginx/sites-enabled/default
nginx -t
systemctl restart nginx
```

## 6. Access Application

Open your browser and navigate to the IP address of your LXC container:
`http://<LXC_IP_ADDRESS>`

- **Frontend**: Dashboard should load.
- **Backend API**: Accessible at `http://<LXC_IP_ADDRESS>/api`.

## Maintenance

- **Pull Updates**:
  ```bash
  cd /opt/WealthPulse
  git pull origin master
  
  # Update Backend
  cd backend
  source venv/bin/activate
  pip install -r requirements.txt
  alembic upgrade head
  systemctl restart wealthpulse-backend
  
  # Update Frontend
  cd ../frontend
  npm install
  npm run build
  ```
