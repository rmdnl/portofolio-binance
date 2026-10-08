#!/bin/bash
# Portfolio Dashboard - Ubuntu VPS Deployment Script
# Run as root: curl -fsSL https://raw.githubusercontent.com/your-repo/main/deploy/install.sh | bash

set -euo pipefail

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log() { echo -e "${BLUE}[INFO]${NC} $*"; }
success() { echo -e "${GREEN}[SUCCESS]${NC} $*"; }
warn() { echo -e "${YELLOW}[WARN]${NC} $*"; }
error() { echo -e "${RED}[ERROR]${NC} $*"; exit 1; }

# Configuration
APP_NAME="portfolio-dashboard"
APP_USER="portfolio"
APP_DIR="/opt/${APP_NAME}"
REPO_URL="https://github.com/rmdnl/portofolio-binance.git"
NODE_VERSION="20"
PORT="8081"

# Check root
if [[ $EUID -ne 0 ]]; then
   error "This script must be run as root"
fi

log "Starting Portfolio Dashboard deployment..."

# Update system
log "Updating system packages..."
apt-get update -qq && apt-get upgrade -y -qq

# Install dependencies
log "Installing dependencies..."
apt-get install -y -qq curl wget git nginx certbot python3-certbot-nginx ufw fail2ban

# Install Node.js
log "Installing Node.js ${NODE_VERSION}..."
curl -fsSL https://deb.nodesource.com/setup_${NODE_VERSION}.x | bash -
apt-get install -y -qq nodejs

# Verify installations
node --version
npm --version

# Create application user
log "Creating application user..."
if ! id "${APP_USER}" &>/dev/null; then
    useradd -r -s /bin/bash -d "${APP_DIR}" -m "${APP_USER}"
    success "User ${APP_USER} created"
else
    log "User ${APP_USER} already exists"
fi

# Clone repository
log "Cloning repository..."
if [[ -d "${APP_DIR}/.git" ]]; then
    log "Repository exists, pulling latest..."
    cd "${APP_DIR}"
    sudo -u "${APP_USER}" git pull
else
    sudo -u "${APP_USER}" git clone "${REPO_URL}" "${APP_DIR}"
    cd "${APP_DIR}"
fi

# Install npm dependencies
log "Installing npm dependencies..."
cd "${APP_DIR}"
sudo -u "${APP_USER}" npm ci --production

# Setup environment file
log "Setting up environment configuration..."
if [[ ! -f "${APP_DIR}/config/.env" ]]; then
    sudo -u "${APP_USER}" cp "${APP_DIR}/config/.env.example" "${APP_DIR}/config/.env"
    warn "Created .env from example. YOU MUST EDIT IT WITH YOUR BINANCE API KEYS!"
    warn "Edit: ${APP_DIR}/config/.env"
else
    log ".env already exists"
fi

# Set permissions
log "Setting file permissions..."
chown -R "${APP_USER}:${APP_USER}" "${APP_DIR}"
chmod 750 "${APP_DIR}"
chmod 640 "${APP_DIR}/config/.env"

# Install systemd service
log "Installing systemd service..."
cp "${APP_DIR}/deploy/portfolio-dashboard.service" /etc/systemd/system/
systemctl daemon-reload
systemctl enable "${APP_NAME}"

# Configure nginx
log "Configuring nginx..."
cp "${APP_DIR}/deploy/nginx.conf" /etc/nginx/sites-available/${APP_NAME}
ln -sf /etc/nginx/sites-available/${APP_NAME} /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default

# Add rate limiting to nginx.conf if not present
if ! grep -q "limit_req_zone" /etc/nginx/nginx.conf; then
    log "Adding rate limiting to nginx.conf..."
    sed -i '/http {/a \    limit_req_zone $binary_remote_addr zone=api:10m rate=10r/s;\n    limit_req_zone $binary_remote_addr zone=ws:10m rate=5r/s;' /etc/nginx/nginx.conf
fi

# Test nginx config
nginx -t

# Configure firewall
log "Configuring firewall..."
ufw allow ssh
ufw allow 'Nginx Full'
ufw --force enable

# Configure fail2ban
log "Configuring fail2ban..."
cat > /etc/fail2ban/jail.d/${APP_NAME}.conf <<EOF
[nginx-http-auth]
enabled = true
port = http,https
logpath = /var/log/nginx/error.log

[nginx-limit-req]
enabled = true
port = http,https
logpath = /var/log/nginx/error.log
maxretry = 10
EOF

systemctl enable fail2ban
systemctl restart fail2ban

# Start services
log "Starting services..."
systemctl restart nginx
systemctl start "${APP_NAME}"

# Wait for service to start
sleep 3

# Check service status
if systemctl is-active --quiet "${APP_NAME}"; then
    success "${APP_NAME} service is running"
else
    error "${APP_NAME} service failed to start. Check logs: journalctl -u ${APP_NAME} -f"
fi

# Display summary
echo ""
echo "╔══════════════════════════════════════════════════════════════╗"
echo "║  PORTFOLIO DASHBOARD DEPLOYMENT COMPLETE                     ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo ""
log "Next steps:"
echo "  1. EDIT CONFIG: nano ${APP_DIR}/config/.env"
echo "     - Add your Binance READ-ONLY API keys"
echo "     - Set BINANCE_TESTNET=false for mainnet"
echo ""
echo "  2. RESTART SERVICE: systemctl restart ${APP_NAME}"
echo ""
echo "  3. CHECK LOGS: journalctl -u ${APP_NAME} -f"
echo ""
echo "  4. ACCESS DASHBOARD:"
echo "     - Direct: http://$(curl -s ifconfig.me):${PORT}"
echo ""
echo "  5. SETUP SSL (optional but recommended):"
echo "     certbot --nginx -d your-domain.com"
echo ""
echo "  6. MONITOR:"
echo "     - Service: systemctl status ${APP_NAME}"
echo "     - Logs:    journalctl -u ${APP_NAME} -f"
echo ""

# Show current .env status
if grep -q "your_read_only_api_key_here" "${APP_DIR}/config/.env"; then
    warn "⚠️  REMEMBER: You must configure your Binance API keys in .env before the dashboard will work!"
fi