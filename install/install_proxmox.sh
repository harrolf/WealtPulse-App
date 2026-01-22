#!/usr/bin/env bash

# Copyright (c) 2024 WealthPulse
# Author: harrolf
# License: MIT
# https://github.com/harrolf/WealthPulse-App

# This script creates a WealthPulse LXC container on Proxmox 
# OR installs WealthPulse inside a standard Debian environment.

set -Eeuo pipefail
shopt -s inherit_errexit nullglob

# Variables
YW=$(echo "\033[33m")
BL=$(echo "\033[36m")
RD=$(echo "\033[01;31m")
BGN=$(echo "\033[4;92m")
GN=$(echo "\033[1;92m")
DGN=$(echo "\033[32m")
CL=$(echo "\033[m")
CM="${GN}✓${CL}"
CROSS="${RD}✗${CL}"
BFR="\\r\\033[K"
HOLD="-"
# Default to silent
VERBOSE=false
STD="/dev/null"
SCRIPT_VERSION="v1.5.7"

# Argument parsing
while [[ $# -gt 0 ]]; do
  case $1 in
    -v|--verbose)
      VERBOSE=true
      STD="/dev/stdout"
      shift
      ;;
    *)
      shift
      ;;
  esac
done

# Headers
function header_info {
echo -e "${BL}
█     █░▓█████ ▄▄▄       ██▓ ▄▄▄█████▓ ██░ ██  ██▓███   █    ██  ██▓      ██████ ▓█████ 
▓█░ █ ░█░▓█   ▀▒████▄    ▓██▒ ▓  ██▒ ▓▒▓██░ ██▒▓██░  ██▒ ██  ▓██▒▓██▒    ▒██    ▒ ▓█   ▀ 
▒█░ █ ░█ ▒███  ▒██  ▀█▄  ▒██▒ ▒ ▓██░ ▒░▒██▀▀██░▓██░ ██▓▒▓██  ▒██░▒██░    ░ ▓██▄   ▒███   
░█░ █ ░█ ▒▓█  ▄░██▄▄▄▄██ ░██░ ░ ▓██▓ ░ ░▓█ ░██ ▒██▄█▓▒ ▒▓▓█  ░██░▒██░      ▒   ██▒▒▓█  ▄ 
░░██▒██▓ ░▒████▒▓█   ▓██▒░██░   ▒██▒ ░ ░▓█▒░██▓▒██▒ ░  ░▒▒█████▓ ░██████▒▒██████▒▒░▒████▒
░ ▓░▒ ▒  ░░ ▒░ ░▒▒   ▓▒█░░▓     ▒ ░░    ▒ ░░▒▓▒░ ░  ░░▒▓▒ ▒ ▒ ░ ▒░▓  ░▒ ▒▓▒ ▒ ░░░ ▒░ ░
  ▒ ░ ░   ░ ░  ░ ▒   ▒▒ ░ ▒ ░     ░     ▒ ░▒░ ░░▒ ░     ░░▒░ ░ ░ ░ ░ ▒  ░░ ░▒  ░ ░ ░ ░  ░
  ░   ░     ░    ░   ▒    ▒ ░   ░       ░  ░░ ░░░        ░░░ ░ ░   ░ ░   ░  ░  ░     ░   
    ░       ░  ░     ░  ░ ░             ░  ░  ░            ░         ░  ░      ░         
${CL}"
echo -e "${DGN}WealthPulse Installer ${SCRIPT_VERSION}${CL}"
}

function msg_info() {
  local msg="$1"
  echo -ne " ${HOLD} ${YW}${msg}..."
}

function msg_ok() {
  local msg="$1"
  echo -e "${BFR} ${CM} ${GN}${msg}${CL}"
}

function msg_error() {
  local msg="$1"
  echo -e "${BFR} ${CROSS} ${RD}${msg}${CL}"
}

# Core Logic
function check_root() {
  if [[ "$(id -u)" -ne 0 || $(ps -o comm= -p $$) == "sudo" ]]; then
    clear
    msg_error "Please run this script as root."
    echo -e "\nExiting..."
    sleep 2
    exit 1
  fi
}

# --- Application Installer (Guest Mode) ---
function install_app() {
    header_info
    msg_info "Detected Guest Environment. Starting Application Install"
    
    # Update System
    msg_info "Updating system packages"
    apt-get update > $STD 2>&1
    apt-get upgrade -y > $STD 2>&1
    apt-get install -y git python3 python3-venv python3-pip curl postgresql postgresql-contrib build-essential nginx > $STD 2>&1
    msg_ok "System updated and dependencies installed"

    # Install Node.js
    msg_info "Installing Node.js"
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash - > $STD 2>&1
    apt-get install -y nodejs > $STD 2>&1
    msg_ok "Node.js installed"

    # Clone Repo
    TARGET_DIR="/opt/WealthPulse"
    msg_info "Setting up repository at $TARGET_DIR"
    if [ -d "$TARGET_DIR" ]; then
        cd "$TARGET_DIR"
        # Force clean state to avoid conflicts from local package-lock.json changes
        git fetch origin > $STD 2>&1
        git reset --hard origin/master > $STD 2>&1
    else
        git clone https://github.com/harrolf/WealthPulse-App.git "$TARGET_DIR" > $STD 2>&1
    fi
    msg_ok "Repository verified"

    # Database
    msg_info "Configuring PostgreSQL"
    ENV_FILE="$TARGET_DIR/backend/.env"
    SETUP_DB_PASS=false

    if [ -f "$ENV_FILE" ]; then
        msg_ok "Existing .env found, keeping credentials"
    else
        DB_PASS=$(openssl rand -base64 12)
        SETUP_DB_PASS=true
        msg_ok "Generated new database credentials"
    fi

    # Database & User Creation (Idempotent)
    su - postgres -c "psql -c \"SELECT 1 FROM pg_database WHERE datname = 'wealthpulse'\" | grep -q 1 || psql -c \"CREATE DATABASE wealthpulse;\"" > $STD 2>&1
    su - postgres -c "psql -c \"SELECT 1 FROM pg_roles WHERE rolname = 'wealthuser'\" | grep -q 1 || psql -c \"CREATE USER wealthuser;\"" > $STD 2>&1

    if [ "$SETUP_DB_PASS" = "true" ]; then
        su - postgres -c "psql -c \"ALTER USER wealthuser WITH PASSWORD '$DB_PASS';\"" > $STD 2>&1
    fi
    # Always ensure permissions are correct (fixes idempotency issues on re-runs)
    su - postgres -c "psql -d wealthpulse -c \"GRANT ALL ON SCHEMA public TO wealthuser;\"" > $STD 2>&1
    su - postgres -c "psql -c \"GRANT ALL PRIVILEGES ON DATABASE wealthpulse TO wealthuser;\"" > $STD 2>&1
    
    msg_ok "PostgreSQL configured"

    # Backend
    msg_info "Building Backend"
    cd "$TARGET_DIR/backend"
    if [ ! -d "venv" ]; then
        python3 -m venv venv
    fi
    source venv/bin/activate
    pip install -r requirements.txt > $STD 2>&1

    if [ ! -f ".env" ]; then
        cp .env.example .env
        SAFE_PASS=$(echo "$DB_PASS" | sed 's/[\/&]/\\&/g')
        sed -i "s|postgresql://user:password@localhost/wealthpulse|postgresql://wealthuser:$SAFE_PASS@localhost/wealthpulse|g" .env
    fi
    
    # --- Security Audit & Hardening (.env) ---
    msg_info "Auditing .env security keys"
    
    # helper to set/update .env
    function set_env_var() {
        local var=$1
        local val=$2
        if grep -q "^${var}=" .env; then
            sed -i "s|^${var}=.*|${var}=${val}|g" .env
        else
            echo "${var}=${val}" >> .env
        fi
    }

    # 1. SECRET_KEY
    if grep -q "your-secret-key-change-in-production" .env || ! grep -q "^SECRET_KEY=" .env; then
        NEW_SECRET=$(openssl rand -base64 32)
        set_env_var "SECRET_KEY" "$NEW_SECRET"
        msg_ok "SECRET_KEY hardened"
    fi

    # 2. ENCRYPTION_KEY
    # Check if missing, empty, or just placeholder
    if ! grep -q "^ENCRYPTION_KEY=" .env || [ -z "$(grep "^ENCRYPTION_KEY=" .env | cut -d'=' -f2- | tr -d ' "')" ]; then
        msg_info "Generating ENCRYPTION_KEY"
        NEW_ENC_KEY=$(python3 -c 'from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())')
        set_env_var "ENCRYPTION_KEY" "$NEW_ENC_KEY"
        msg_ok "ENCRYPTION_KEY generated"
    fi

    # 3. REFRESH_TOKEN_SECRET
    if grep -q "your-refresh-secret-key-change-in-production" .env || ! grep -q "^REFRESH_TOKEN_SECRET=" .env; then
        NEW_REFRESH=$(openssl rand -base64 32)
        set_env_var "REFRESH_TOKEN_SECRET" "$NEW_REFRESH"
        msg_ok "REFRESH_TOKEN_SECRET hardened"
    fi

    # Run Database Migrations
    msg_info "Running database migrations"
    alembic upgrade head > $STD 2>&1
    msg_ok "Migrations applied"


    
    # Run Seed Data
    msg_info "Seeding Database"
    python3 -m app.seed > $STD 2>&1
    msg_ok "Database seeded"

    msg_ok "Backend built and migrations applied"

    # Systemd
    msg_info "Configuring Service"
    cat <<EOF > /etc/systemd/system/wealthpulse-backend.service
[Unit]
Description=WealthPulse Backend
After=network.target postgresql.service

[Service]
User=root
WorkingDirectory=$TARGET_DIR/backend
ExecStart=$TARGET_DIR/backend/venv/bin/uvicorn app.main:app --host 0.0.0.0 --port 8000
Restart=always

[Install]
WantedBy=multi-user.target
EOF
    systemctl daemon-reload > $STD 2>&1
    systemctl enable wealthpulse-backend > $STD 2>&1
    systemctl restart wealthpulse-backend > $STD 2>&1
    msg_ok "Systemd service active"

    # Frontend
    msg_info "Building Frontend"
    cd "$TARGET_DIR/frontend"
    
    # Create frontend .env if it doesn't exist
    if [ ! -f ".env" ]; then
        cat <<EOF > .env
# Frontend development server port
VITE_PORT=3000

# Backend API proxy target
VITE_DEV_PROXY_TARGET=http://localhost:8000
EOF
        msg_ok "Frontend .env created"
    fi
    
    npm install > $STD 2>&1
    npm run build > $STD 2>&1
    msg_ok "Frontend built"

    # Nginx
    msg_info "Configuring Nginx"
    cat <<EOF > /etc/nginx/sites-available/wealthpulse
server {
    listen 80;
    server_name _;
    root $TARGET_DIR/frontend/dist;
    index index.html;
    location / {
        try_files \$uri \$uri/ /index.html;
    }
    location /api {
        proxy_pass http://localhost:8000;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
    }
    location /docs { proxy_pass http://localhost:8000/docs; }
    location /openapi.json { proxy_pass http://localhost:8000/openapi.json; }
}
EOF
    ln -sf /etc/nginx/sites-available/wealthpulse /etc/nginx/sites-enabled/
    rm -f /etc/nginx/sites-enabled/default
    nginx -t > $STD 2>&1
    systemctl restart nginx
    msg_ok "Nginx configured"

    IP=$(hostname -I | awk '{print $1}')
    echo -e "${GN} Installation Complete! Access at: http://${IP} ${CL}"
}


# --- Proxmox Host Installer (Host Mode) ---
function install_host() {
    # Check dependencies
    if ! command -v whiptail > $STD 2>&1; then
        apt-get install -y whiptail > $STD 2>&1
    fi

    # Defaults
    TEMPLATE_ID="debian-12-standard"
    CT_TYPE="1" # 1=Unprivileged
    PCT_OSTYPE="debian"
    PCT_OSVERSION="12"
    PCT_DISK_SIZE="8"
    PCT_RAM="2048"
    PCT_SWAP="512"
    PCT_CORES="2"
    PCT_BRIDGE="vmbr0"
    PCT_GW=""
    PCT_IP="dhcp"
    PCT_NAME="wealthpulse"
    DS="local-lvm" # Default Storage

    # Get Next ID
    NEXTID=$(pvesh get /cluster/nextid)
    CTID=$NEXTID
    
    # Header
    clear
    header_info
    echo -e "${BL}This wizard will create a new LXC container and install WealthPulse.${CL}"
    
    if (whiptail --backtitle "Proxmox VE Helper Scripts" --title "WealthPulse App" --yesno "This will create a New ${PCT_OSTYPE}-${PCT_OSVERSION} LXC. Proceed?" 10 58); then
        :
    else
        header_info
        echo -e "User exited script \n"
        exit
    fi

    # Advanced Settings
    if (whiptail --backtitle "Proxmox VE Helper Scripts" --title "Settings" --yesno "Use Default Settings?" --no-button "Advanced" 10 58); then
        # Use Defaults
        :
    else
        # Customized
        CT_TYPE=$(whiptail --backtitle "Proxmox VE Helper Scripts" --title "Container Type" --radiolist "Choose Type" 10 58 2 \
          "1" "Unprivileged" ON \
          "0" "Privileged" OFF \
          3>&1 1>&2 2>&3)
        
        CTID=$(whiptail --backtitle "Proxmox VE Helper Scripts" --title "Container ID" --inputbox "Set Container ID" 10 58 "$NEXTID" 3>&1 1>&2 2>&3)
        PCT_NAME=$(whiptail --backtitle "Proxmox VE Helper Scripts" --title "Hostname" --inputbox "Set Hostname" 10 58 "$PCT_NAME" 3>&1 1>&2 2>&3)
        PCT_DISK_SIZE=$(whiptail --backtitle "Proxmox VE Helper Scripts" --title "Disk Size" --inputbox "Set Disk Size (GB)" 10 58 "$PCT_DISK_SIZE" 3>&1 1>&2 2>&3)
        PCT_CORES=$(whiptail --backtitle "Proxmox VE Helper Scripts" --title "Cores" --inputbox "Set Cores" 10 58 "$PCT_CORES" 3>&1 1>&2 2>&3)
        PCT_RAM=$(whiptail --backtitle "Proxmox VE Helper Scripts" --title "Ram" --inputbox "Set RAM (MB)" 10 58 "$PCT_RAM" 3>&1 1>&2 2>&3)
        PCT_BRIDGE=$(whiptail --backtitle "Proxmox VE Helper Scripts" --title "Bridge" --inputbox "Set Bridge" 10 58 "$PCT_BRIDGE" 3>&1 1>&2 2>&3)
        
        # Storage
        STORAGE_LIST=$(pvesm status -content rootdir | awk 'NR>1 {print $1}')
        if [ -z "$STORAGE_LIST" ]; then
             msg_error "No valid storage found for rootdir."
             exit 1
        fi
        DS=$(whiptail --backtitle "Proxmox VE Helper Scripts" --title "Storage" --menu "Select Storage" 15 58 5 $(for s in $STORAGE_LIST; do echo "$s" "$s"; done) 3>&1 1>&2 2>&3)
        
        # Password
        PCT_PASSWORD=$(whiptail --backtitle "Proxmox VE Helper Scripts" --title "Password" --passwordbox "Set Root Password (leave empty for none)" 10 58 3>&1 1>&2 2>&3)
    fi

    # Validation/Logic
    [ "$CT_TYPE" == "1" ] && FEATURES="nesting=1,keyctl=1" || FEATURES="nesting=1"
    
    # Template Check
    msg_info "Updating Template List"
    pveam update > $STD 2>&1 || true
    
    # Find valid template
    # We use || true to prevent pipefail from exiting script if grep finds nothing
    TEMPLATE=$(pveam available | grep "debian-12" | head -n 1 | awk '{print $2}' || true)
    if [ -z "$TEMPLATE" ]; then
        msg_error "Debian 12 Template not found. Check your PVE storage templates."
        exit 1
    fi
    msg_ok "Using Template: $TEMPLATE"

    # Download Template
    if ! pveam list local | grep -q "$TEMPLATE"; then
        msg_info "Downloading Template"
        pveam download local $TEMPLATE > $STD 2>&1
        msg_ok "Downloaded $TEMPLATE"
    fi

    # Create CT
    msg_info "Creating Container $CTID ($PCT_NAME)"
    
    # Build params
    CREATE_OPTS=(
        --hostname "$PCT_NAME"
        --cores "$PCT_CORES"
        --memory "$PCT_RAM"
        --swap "$PCT_SWAP"
        --rootfs "${DS}:${PCT_DISK_SIZE}"
        --net0 "name=eth0,bridge=${PCT_BRIDGE},ip=${PCT_IP},type=veth"
        --features "$FEATURES"
        --ostype "$PCT_OSTYPE"
        --unprivileged "$CT_TYPE"
    )
    
    if [ -n "${PCT_PASSWORD:-}" ]; then
        CREATE_OPTS+=(--password "$PCT_PASSWORD")
    fi

    pct create "$CTID" "local:vztmpl/$(basename $TEMPLATE)" "${CREATE_OPTS[@]}" > $STD 2>&1
    msg_ok "Container Created"

    # Start
    msg_info "Starting Container"
    pct start "$CTID"
    msg_ok "Started Container"

    msg_info "Waiting for Network..."
    sleep 5
    
    # Bootstrap Guest Installer
    msg_info "Bootstrapping Installation..."
    
    # Pass verbose flag inside content if enabled
    INNER_ARGS=""
    if [ "$VERBOSE" = true ]; then INNER_ARGS="--verbose"; fi
    
    # We pass this script itself into the container to run in "Guest Mode"
    # This ensures consistency without needing to curl from GitHub again.
    cat "$0" | pct exec "$CTID" -- bash -c "cat > /tmp/install_wealthpulse.sh && chmod +x /tmp/install_wealthpulse.sh && /tmp/install_wealthpulse.sh $INNER_ARGS"
    
    msg_ok "Installation Finished"
    
    # Get IP
    IP=$(pct exec "$CTID" -- ip a s dev eth0 | grep 'inet ' | awk '{print $2}' | cut -d/ -f1)

    # Set Container Description
    msg_info "Setting Container Description"
    DESCRIPTION="<div align='center'>
    <h2 style='color: #3b82f6;'>WealthPulse</h2>
    <strong>Wealth Management Platform</strong><br><br>
    <a href='http://${IP}' target='_blank' style='font-size: 1.2em; font-weight: bold; text-decoration: none; color: #10b981;'>Open Application</a><br>
    <small>(http://${IP})</small><br><br>
    <p>Installed via Auto-Script</p>
    </div>"
    
    pct set "$CTID" -description "$DESCRIPTION" >/dev/null 2>&1
    msg_ok "Description Set"

    echo -e "${GN} Successfully created WealthPulse LXC! ${CL}"
    echo -e "${GN} Access it at: http://${IP} ${CL}"
}


# Main Detection
check_root

if command -v pveversion >/dev/null 2>&1; then
    # We are on Proxmox Host
    install_host
else
    # We are inside the container
    install_app
fi
