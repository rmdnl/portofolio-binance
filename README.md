# Portfolio Dashboard - Retrofuture Edition

A stunning, real-time Binance portfolio dashboard with retrofuturism/Gen-Z aesthetics. Built for monitoring live balances, positions, trades, and PnL - **read-only, no trading capabilities**.

![Dashboard Preview](assets/preview.png)

## Features

### 📊 Live Portfolio Tracking
- **Total Portfolio Value** - Combined spot + futures valuation in real-time
- **Asset Balances** - Spot and futures wallets with 24h change % and portfolio allocation
- **Open Positions** - Futures positions with mark price, liquidation price, unrealized PnL, ROE, leverage
- **Recent Trades** - Last 100 trades across spot and futures with fees, side, role (maker/taker)

### 📈 PnL Analytics
- **Unrealized PnL** - Per-position breakdown with liquidation distance warnings
- **Realized PnL (30d)** - Realized profits, funding fees, commissions, net PnL by symbol
- **Win Rate** - 30-day trading performance metrics
- **Interactive Charts** - Portfolio allocation (doughnut) + PnL timeline (line)

### 🎨 Retrofuturism Gen-Z Design
- CRT scanlines, vignette, glowing accents
- Orbitron + JetBrains Mono + Space Grotesk typography
- Dark/light mode support (system preference)
- Responsive: desktop sidebar + mobile drawer
- WebSocket live updates (no polling)

### 🔒 Security First
- **Read-only API keys only** - No trading/withdrawal permissions possible
- Rate limiting (API: 100/min, WS: 30/min)
- Helmet.js security headers
- CORS restricted to same origin in production
- Systemd hardening (no new privileges, private tmp, memory protection)
- Nginx rate limiting + fail2ban integration
- Environment-based config (no secrets in code)

## Quick Start (Development)

```bash
# Clone and enter directory
cd portfolio-dashboard

# Install dependencies
npm install

# Copy and configure environment
cp config/.env.example config/.env
# Edit config/.env with your Binance READ-ONLY API keys

# Start development server
npm run dev

# Open http://localhost:8081
```

## Production Deployment (Ubuntu VPS)

### One-Command Install
```bash
curl -fsSL https://raw.githubusercontent.com/rmdnl/portofolio-binance/main/portfolio-dashboard/deploy/install.sh | bash
```

### Manual Steps

1. **Provision VPS** (Ubuntu 22.04/24.04, 1GB+ RAM)
2. **Run install script** (as root):
   ```bash
   bash deploy/install.sh
   ```
3. **Configure API keys**:
   ```bash
   nano /opt/portfolio-dashboard/portfolio-dashboard/config/.env
   ```
4. **Restart service**:
   ```bash
   systemctl restart portfolio-dashboard
   ```
5. **Setup SSL** (recommended):
   ```bash
   certbot --nginx -d your-domain.com
   ```

### Service Management
```bash
# Status
systemctl status portfolio-dashboard

# Logs
journalctl -u portfolio-dashboard -f

# Restart
systemctl restart portfolio-dashboard

# Update
bash deploy/update.sh
```

## Binance API Key Setup

1. Go to [Binance API Management](https://www.binance.com/en/my/settings/api-management)
2. Create new API key
3. **Enable only**: "Enable Reading" ✅
4. **Disable**: Spot Trading ❌, Futures Trading ❌, Withdrawals ❌, IP whitelist (optional but recommended)
5. Copy API Key and Secret to `.env`

```env
BINANCE_API_KEY=your_key_here
BINANCE_API_SECRET=your_secret_here
BINANCE_TESTNET=false
```

## Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | 8081 | Server port |
| `NODE_ENV` | production | Environment mode |
| `BINANCE_API_KEY` | - | Read-only API key |
| `BINANCE_API_SECRET` | - | Read-only API secret |
| `BINANCE_TESTNET` | false | Use testnet |
| `RATE_LIMIT_WINDOW_MS` | 60000 | Rate limit window |
| `RATE_LIMIT_MAX_REQUESTS` | 100 | Max requests/window |
| `BALANCE_REFRESH_MS` | 5000 | Balance refresh interval |
| `TRADES_REFRESH_MS` | 10000 | Trades refresh interval |
| `PNL_REFRESH_MS` | 10000 | PnL refresh interval |
| `PRICE_REFRESH_MS` | 2000 | Price refresh interval |

## Architecture

```
portfolio-dashboard/
├── src/
│   ├── server.js           # Express + WS server
│   ├── middleware/
│   │   ├── rateLimit.js    # Express rate limiting
│   │   └── errorHandler.js # Centralized error handling
│   └── services/
│       ├── binance.js      # Binance API client (signed requests)
│       ├── portfolio.js    # Portfolio aggregation & caching
│       └── websocket.js    # WS connection manager
├── public/
│   ├── index.html          # Single-page dashboard
│   ├── css/styles.css      # Retrofuturism styling
│   └── js/
│       ├── app.js          # Main application controller
│       ├── ui.js           # UI rendering & interactions
│       ├── charts.js       # Chart.js visualizations
│       └── utils.js        # Formatters & helpers
├── config/
│   ├── .env.example        # Environment template
│   └── .env                # Your secrets (gitignored)
└── deploy/
    ├── portfolio-dashboard.service  # Systemd unit
    ├── nginx.conf                  # Reverse proxy config
    ├── install.sh                  # One-command installer
    └── update.sh                   # Update script
```

## API Endpoints

| Endpoint | Description |
|----------|-------------|
| `GET /api/health` | Health check |
| `GET /api/account/info` | Account information |
| `GET /api/account/balances` | Spot + futures balances |
| `GET /api/positions` | Open futures positions |
| `GET /api/trades?symbol=&limit=` | Recent trades |
| `GET /api/pnl/unrealized` | Unrealized PnL breakdown |
| `GET /api/pnl/realized?startTime=&endTime=` | Realized PnL (30d default) |
| `GET /api/market/prices` | All symbol prices |
| `GET /api/market/ticker/24hr` | 24h ticker statistics |

## WebSocket Messages

**Client → Server:**
```json
{ "type": "ping" }
{ "type": "subscribe", "channels": ["all"] }
{ "type": "getSnapshot", "channels": ["balances", "positions"] }
```

**Server → Client:**
```json
{ "type": "welcome", "timestamp": 1234567890 }
{ "type": "snapshot", "data": { "balances": [], "positions": [], ... } }
{ "type": "balances", "data": [...] }
{ "type": "positions", "data": [...] }
{ "type": "trades", "data": [...] }
{ "type": "unrealizedPnL", "data": {...} }
{ "type": "realizedPnL", "data": {...} }
{ "type": "prices", "data": [...] }
{ "type": "ticker24hr", "data": [...] }
{ "type": "pong", "timestamp": 1234567890 }
```

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `Ctrl/Cmd + R` | Refresh data |
| `Escape` | Close mobile sidebar |
| `1-6` | Switch tabs (when not in input) |

## Tabs Overview

1. **Overview** - Portfolio value, unrealized/realized PnL, win rate, allocation chart, PnL timeline, top gainers/losers
2. **Balances** - Filterable table of all assets with values and 24h changes
3. **Positions** - Open futures positions with liquidation monitoring
4. **Trades** - Recent trades with market/symbol filters
5. **PnL** - Detailed unrealized + realized breakdowns
6. **Market** - 24h market data with search and sorting

## Security Checklist

- [ ] API keys are **read-only** (no trading/withdrawal)
- [ ] IP whitelist configured on Binance API key
- [ ] `.env` file permissions: `640` (root:portfolio)
- [ ] Firewall: only 22 (SSH), 80/443 (HTTP/HTTPS) open
- [ ] fail2ban active and monitoring nginx
- [ ] SSL certificate installed (Let's Encrypt)
- [ ] Regular updates: `bash deploy/update.sh`
- [ ] Monitor logs: `journalctl -u portfolio-dashboard -f`

## Troubleshooting

### Service won't start
```bash
journalctl -u portfolio-dashboard -f
# Check .env has valid API keys
# Check port 8081 not in use: ss -tlnp | grep 8081
```

### "Invalid API credentials" error
- Verify API key/secret in `.env`
- Ensure "Enable Reading" is checked on Binance
- Check IP whitelist matches VPS IP

### WebSocket disconnects
- Check nginx proxy config has `proxy_read_timeout 86400`
- Verify VPS firewall allows WebSocket upgrade
- Check Binance API rate limits (1200/min)

### No data showing
- Verify API keys have correct permissions
- Check logs for Binance API errors
- Ensure VPS time is synced (ntp)

## Performance

- **Memory**: ~80-120MB RSS
- **CPU**: <1% idle, ~5% during refresh
- **Network**: ~50KB/s WebSocket, ~200KB/s API polls
- **Refresh intervals**: Configurable via env vars

## Browser Support

- Chrome 90+, Firefox 88+, Safari 14+, Edge 90+
- Requires ES2022 modules, WebSocket, Canvas API

## License

MIT License - See LICENSE file

## Disclaimer

**This software is for portfolio monitoring only.** It uses read-only API keys and cannot execute trades, transfers, or withdrawals. Always verify your API key permissions on Binance. The authors are not responsible for any financial losses.

---

Built with ❤️ for the retrofuture