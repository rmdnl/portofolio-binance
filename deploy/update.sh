#!/bin/bash
# Portfolio Dashboard - Update Script
# Run as root: bash update.sh

set -euo pipefail

APP_NAME="portfolio-dashboard"
APP_USER="portfolio"
APP_DIR="/opt/${APP_NAME}"

log() { echo -e "\033[0;34m[INFO]\033[0m $*"; }
success() { echo -e "\033[0;32m[SUCCESS]\033[0m $*"; }
error() { echo -e "\033[0;31m[ERROR]\033[0m $*"; exit 1; }

if [[ $EUID -ne 0 ]]; then
   error "This script must be run as root"
fi

log "Updating Portfolio Dashboard..."

cd "${APP_DIR}"
log "Pulling latest changes..."
sudo -u "${APP_USER}" git pull

cd "${APP_DIR}/portfolio-dashboard"
log "Installing/updating dependencies..."
sudo -u "${APP_USER}" npm ci --production

log "Restarting service..."
systemctl restart "${APP_NAME}"

sleep 2

if systemctl is-active --quiet "${APP_NAME}"; then
    success "Update complete! Service is running."
else
    error "Service failed to start. Check logs: journalctl -u ${APP_NAME} -f"
fi