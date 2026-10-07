# Portfolio Dashboard - Retrofuture Edition 🚀

> **Dashboard portfolio Binance yang bikin kamu ngerasa kayak hacker 90-an tapi pake tech modern. Read-only, aman, zero trading risk.**

![Dashboard Preview](assets/preview.png)

---

## 🎯 Apa Ini?

Dashboard **real-time** buat monitoring portfolio Binance kamu — balance, posisi futures, trade history, unrealized & realized PnL. Semua dalam satu UI yang **aesthetic banget** pake vibe *retrofuturism* + *Gen-Z*. 

**Yang bikin beda:**
- ✅ **Read-only only** — API key cuma butuh permission "Enable Reading", gak bisa trade, gak bisa withdraw
- ✅ **Real-time WebSocket** — Data update otomatis, gak perlu refresh manual (kecuali mau flex)
- ✅ **Dual Currency** — USD ($) **dan** IDR (Rp) — rate real-time dari API exchanger
- ✅ **Mobile-first responsive** — Bisa dibuka di HP, tablet, laptop, bahkan smart fridge kalau mau
- ✅ **Secure by default** — Rate limiting, helmet.js, systemd hardening, nginx + fail2ban ready

---

## ✨ Fitur-Fitur Keren

### 📊 **Overview Tab** — *Command Center Utama*
- **Total Portfolio Value** — Gabungan spot + futures, live
- **Unrealized PnL** — Profit/loss posisi terbuka, real-time
- **Realized PnL (30D)** — Profit/loss yang sudah terealisasi 30 hari terakhir
- **Win Rate** — Persentase trade menang, biar tau skill level
- **Portfolio Allocation Chart** — Donut chart interaktif (by asset / by type)
- **PnL Timeline** — Line chart daily vs cumulative
- **Top Gainers / Losers** — Posisi paling profit & paling rugi

### 💰 **Balances Tab** — *Dompet Digital*
- Semua asset spot & futures dalam satu tabel
- Filter: All / Spot Only / Futures Only / Non-zero Only
- Estimasi nilai per asset + 24h change %
- Persentase alokasi portfolio per asset

### 📈 **Positions Tab** — *Futures Open Positions*
- Symbol, Side (LONG/SHORT), Size, Entry, Mark Price
- **Liquidation Price** + **Distance to Liq (%)** — warnanya berubah: Hijau (aman) → Kuning (waspada) → Merah (danger zone)
- Unrealized PnL + ROE % real-time
- Leverage & Margin Type

### 📋 **Trades Tab** — *History Trade*
- 100 trade terbaru (Spot + Futures)
- Filter by Market (Spot/Futures) & Symbol
- Time, Price, Qty, Quote, Fee, Role (Maker/Taker)
- Side badge: BUY (hijau) / SELL (merah)

### 📊 **PnL Tab** — *Deep Dive Analytics*
**Unrealized PnL Breakdown:**
- Per posisi: Symbol, Side, Size, Entry, Mark, PnL, ROE, Liq Distance

**Realized PnL (30 Days):**
- Per symbol: Realized PnL, Funding Fees, Commission, Net PnL, Trade Count
- Summary: Total Realized, Total Funding, Total Fees, **Net PnL**

### 🌐 **Market Tab** — *Market Overview*
- 24h ticker data untuk semua symbol
- Search real-time + Sort by Volume / 24h Change / Price
- Price, 24h High/Low, Volume, Quote Volume

---

## 🛠️ Tech Stack

| Layer | Tech |
|-------|------|
| **Runtime** | Node.js 20+ (ES Modules) |
| **Backend** | Express.js + ws (WebSocket) |
| **Binance API** | Signed REST requests (HMAC SHA256) |
| **Frontend** | Vanilla JS (ES Modules), Chart.js 4 |
| **Styling** | CSS Custom Properties, CSS Grid, Flexbox |
| **Fonts** | Orbitron (display), JetBrains Mono (data), Space Grotesk (UI) |
| **Process Manager** | systemd (hardened) |
| **Reverse Proxy** | Nginx + rate limiting + SSL ready |
| **Security** | Helmet.js, CORS, Rate limiting, fail2ban |

---

## 🚀 Quick Start (Development)

```bash
# 1. Masuk ke folder
cd portfolio-dashboard

# 2. Install dependencies
npm install

# 3. Copy config template
cp config/.env.example config/.env

# 4. EDIT .env — MASUKIN API KEY BINANCE KAMU (READ-ONLY!)
nano config/.env

# 5. Jalankan
npm run dev
# atau production: npm start

# 6. Buka browser
# http://localhost:8081
```

---

## 🖥️ Production Deployment (Ubuntu VPS)

### One-Command Install (Recommended)
```bash
# Jalankan sebagai root
curl -fsSL https://raw.githubusercontent.com/rmdnl/portofolio-binance/main/portfolio-dashboard/deploy/install.sh | bash
```

### Manual Step-by-Step

**1. Provision VPS**
- Ubuntu 22.04 / 24.04 LTS
- Minimal 1GB RAM, 1 vCPU
- IPv4 publik

**2. Run Install Script**
```bash
# Sebagai root
bash deploy/install.sh
```

**3. Konfigurasi API Key**
```bash
nano /opt/portfolio-dashboard/portfolio-dashboard/config/.env
```
Isi:
```env
BINANCE_API_KEY=your_read_only_api_key
BINANCE_API_SECRET=your_read_only_api_secret
BINANCE_TESTNET=false
```

**4. Restart Service**
```bash
systemctl restart portfolio-dashboard
```

**5. Setup SSL (Wajib kalau pakai domain)**
```bash
certbot --nginx -d dashboard.luardi.com
```

**6. Akses Dashboard**
- **HTTP**: `http://IP-VPS-KAMU` (port 80 via nginx)
- **Direct**: `http://IP-VPS-KAMU:8081` (langsung ke Node.js)

---

## 🔑 Setup Binance API Key (PENTING!)

1. Buka [Binance API Management](https://www.binance.com/en/my/settings/api-management)
2. Klik **Create API** → beri nama (misal: `portfolio-dashboard-readonly`)
3. **Permission HANYA centang:**
   - ✅ **Enable Reading** (ini WAJIB)
4. **JANGAN centang:**
   - ❌ Enable Spot Trading
   - ❌ Enable Futures Trading  
   - ❌ Enable Vanilla Options
   - ❌ Enable Leverage Tokens
   - ❌ Withdrawals
   - ❌ Universal Transfer
5. **IP Whitelist** (Highly Recommended): Masukkan IP VPS kamu
6. Copy **API Key** & **Secret Key** → paste ke `.env`

> ⚠️ **PERINGATAN**: Kalau kamu enable trading/withdrawal, dashboard ini TETAP gak bisa trade (kode gak support), tapi keamanan API key kamu berkurang. **Hanya Enable Reading!**

---

## ⚙️ Konfigurasi Environment

| Variable | Default | Deskripsi |
|----------|---------|-----------|
| `PORT` | `8081` | Port server |
| `NODE_ENV` | `production` | Mode environment |
| `BINANCE_API_KEY` | - | Read-only API Key |
| `BINANCE_API_SECRET` | - | Read-only API Secret |
| `BINANCE_TESTNET` | `false` | `true` untuk testnet |
| `RATE_LIMIT_WINDOW_MS` | `60000` | Window rate limit (ms) |
| `RATE_LIMIT_MAX_REQUESTS` | `100` | Max request per window |
| `BALANCE_REFRESH_MS` | `5000` | Interval refresh balance |
| `TRADES_REFRESH_MS` | `10000` | Interval refresh trades |
| `PNL_REFRESH_MS` | `10000` | Interval refresh PnL |
| `PRICE_REFRESH_MS` | `2000` | Interval refresh price |

---

## 📱 Mobile Friendly? **YES!**

Dashboard ini **mobile-first** dari hari pertama:

| Device | Experience |
|--------|------------|
| **Desktop (≥1024px)** | Sidebar kiri tetap, full layout |
| **Tablet (768-1024px)** | Sidebar jadi drawer (swipe/klik hamburger) |
| **Mobile (≤640px)** | Stacked cards, touch-friendly, hamburger menu |
| **Landscape Mobile** | Compact header, optimized spacing |

**Fitur Mobile:**
- ☰ Hamburger menu buka/tutup sidebar
- Overlay backdrop tap-to-close
- Touch-friendly tap targets (min 44px)
- Horizontal scroll tabel dengan sticky header
- Responsive font scaling
- Safe area inset support (notch/Dynamic Island)

---

## 🎨 Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl/Cmd + R` | Refresh data manual |
| `Escape` | Tutup sidebar (mobile) |
| `Tab` | Navigasi fokus aksesibilitas |

---

## 📡 API Endpoints

| Endpoint | Deskripsi |
|----------|-----------|
| `GET /api/health` | Health check |
| `GET /api/account/info` | Info akun |
| `GET /api/account/balances` | Balance spot + futures |
| `GET /api/positions` | Posisi futures terbuka |
| `GET /api/trades?symbol=&limit=` | Trade history |
| `GET /api/pnl/unrealized` | Unrealized PnL breakdown |
| `GET /api/pnl/realized?startTime=&endTime=` | Realized PnL (default 30 hari) |
| `GET /api/market/prices` | Semua harga symbol |
| `GET /api/market/ticker/24hr` | 24h ticker stats |

---

## 🔌 WebSocket Messages

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

---

## 🛡️ Security Checklist (Wajib Dicek!)

- [ ] API Key **hanya** "Enable Reading" ✅
- [ ] IP Whitelist di Binance = IP VPS kamu ✅
- [ ] File `.env` permission: `640` (owner: portfolio user) ✅
- [ ] Firewall: Hanya port 22 (SSH), 80/443 (HTTP/HTTPS) ✅
- [ ] fail2ban aktif & monitor nginx ✅
- [ ] SSL Certificate (Let's Encrypt) terpasang ✅
- [ ] Update berkala: `bash deploy/update.sh` ✅
- [ ] Monitor logs: `journalctl -u portfolio-dashboard -f` ✅

---

## 🐛 Troubleshooting

### Service gak mau start
```bash
journalctl -u portfolio-dashboard -f
# Cek .env punya API key valid
# Cek port 8081 gak kepake: ss -tlnp | grep 8081
```

### "Invalid API credentials" error
- Verifikasi API Key/Secret di `.env`
- Pastikan "Enable Reading" dicentang di Binance
- Cek IP Whitelist match dengan IP VPS

### WebSocket disconnect terus
- Cek nginx config punya `proxy_read_timeout 86400`
- Verifikasi firewall VPS allow WebSocket upgrade
- Cek rate limit Binance (1200 req/min)

### Data gak muncul / kosong
- Verifikasi API key permission
- Cek log error Binance API
- Pastikan VPS time sync (ntp/chrony)

### Exchange rate IDR gak update
- Cek koneksi internet VPS (butuh akses ke API exchanger)
- Fallback rate: 15,500 (hardcoded di kode)

---

## 📊 Performance

| Metric | Value |
|--------|-------|
| **Memory** | ~80-120 MB RSS |
| **CPU Idle** | <1% |
| **CPU Refresh** | ~5% saat auto-refresh |
| **Network WS** | ~50 KB/s |
| **Network API** | ~200 KB/s saat poll |
| **Refresh Interval** | Configurable via env |

---

## 🌐 Browser Support

- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+
- **Butuh**: ES2022 Modules, WebSocket, Canvas API, CSS Grid

---

## 📁 Struktur Project

```
portfolio-dashboard/
├── src/
│   ├── server.js           # Express + WS server entry
│   ├── middleware/
│   │   ├── rateLimit.js    # Express rate limiting
│   │   └── errorHandler.js # Centralized error handling
│   └── services/
│       ├── binance.js      # Binance API client (signed)
│       ├── portfolio.js    # Aggregation & caching logic
│       └── websocket.js    # WS connection manager
├── public/
│   ├── index.html          # Single-page dashboard
│   ├── css/styles.css      # Retrofuturism styling (mobile-first)
│   └── js/
│       ├── app.js          # Main controller
│       ├── ui.js           # UI rendering & interactions
│       ├── charts.js       # Chart.js visualizations
│       └── utils.js        # Formatters & helpers
├── config/
│   ├── .env.example        # Template environment
│   └── .env                # Your secrets (GITIGNORED!)
└── deploy/
    ├── portfolio-dashboard.service  # Systemd unit (hardened)
    ├── nginx.conf                  # Reverse proxy config
    ├── install.sh                  # One-command installer
    └── update.sh                   # Update script
```

---

## 🤝 Contributing

PR welcome! Tapi please:
1. Jangan tambah fitur trading/withdrawal (prinsip read-only)
2. Pertahankan aesthetic retrofuturism
3. Mobile-first always
4. Indonesian comments appreciated 🇮🇩

---

## ⚠️ Disclaimer

**SOFTWARE INI HANYA UNTUK MONITORING PORTFOLIO.** Menggunakan read-only API keys, **tidak bisa** eksekusi trade, transfer, atau withdraw. Selalu verifikasi permission API key di Binance. Penulis **tidak bertanggung jawab** atas kerugian finansial apapun.

> "Not your keys, not your coins. Not your API perms, not your risk." — *Probably someone smart*

---

## 📄 License

MIT License — Bebas dipakai, dimodifikasi, dikomersilkan. Cuma jangan lupa credit.

---

## 🙏 Credits

- **Binance API** — Data source
- **Chart.js** — Visualization
- **Google Fonts** — Orbitron, JetBrains Mono, Space Grotesk
- **Exchangerate-API** — USD/IDR rate (fallback)
- **Gen-Z Internet Culture** — Inspirasi aesthetic

---

<div align="center">

**Dibangun dengan ❤️ + ☕ + 🌙 buat para degen yang mau monitoring portfolio pake style.**

`v1.0.0-RETRO` • `Node 20+` • `Zero Trading Risk` • `100% Read-Only`

</div>