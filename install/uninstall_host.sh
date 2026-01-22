#!/bin/bash

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
NC='\033[0m'

echo -e "${RED}WARNING: This script will remove WealthPulse and its dependencies (Node.js, Postgres, Nginx).${NC}"
echo -e "${RED}Do not run this if you use these services for other things on this host!${NC}"
read -p "Are you sure you want to proceed? (y/N) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]
then
    exit 1
fi

echo -e "${GREEN}Removing WealthPulse directory...${NC}"
rm -rf /opt/WealthPulse

echo -e "${GREEN}Stopping and removing services...${NC}"
systemctl stop wealthpulse-backend 2>/dev/null || true
systemctl disable wealthpulse-backend 2>/dev/null || true
rm -f /etc/systemd/system/wealthpulse-backend.service
systemctl daemon-reload

echo -e "${GREEN}Removing Nginx configuration...${NC}"
rm -f /etc/nginx/sites-enabled/wealthpulse
rm -f /etc/nginx/sites-available/wealthpulse
systemctl reload nginx 2>/dev/null || true

echo -e "${GREEN}Purging packages...${NC}"
# Only remove packages that were likely installed by our script
# Be careful not to remove things that Proxmox depends on, though standard PVE doesn't use these.
apt purge -y nodejs postgresql-17 postgresql-client-17 postgresql-common nginx nginx-common sysstat

echo -e "${GREEN}Autoremoving unused dependencies...${NC}"
apt autoremove -y

echo -e "${GREEN}Removing Repo Lists...${NC}"
rm -f /etc/apt/sources.list.d/nodesource.list
apt update

echo -e "${GREEN}Cleanup Complete.${NC}"
