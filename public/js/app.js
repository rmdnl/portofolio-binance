import { ChartManager } from './charts.js';
import { WebSocketClient } from './websocket.js';
import { UIManager } from './ui.js';
import { formatNumber, formatCurrency, formatPercent, formatTime, timeAgo } from './utils.js';

class PortfolioDashboard {
  constructor() {
    this.ws = null;
    this.charts = new ChartManager();
    this.ui = new UIManager();
    this.data = {
      balances: [],
      positions: [],
      trades: [],
      unrealizedPnL: { total: 0, bySymbol: {}, positions: [] },
      realizedPnL: { totalRealized: 0, totalFunding: 0, totalCommission: 0, netPnL: 0, bySymbol: {} },
      prices: [],
      ticker24hr: [],
      lastUpdate: 0,
      serverTimeOffset: 0
    };
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 10;
    this.reconnectDelay = 2000;
    this.isConnected = false;
    this.lastPing = 0;
    this.latency = 0;
    this.currency = 'USD'; // 'USD' or 'IDR'
    this.usdToIdrRate = 15500;
    this.rateUpdateInterval = null;
    
    this.init();
  }

  async init() {
    this.charts.setDashboard(this);
    this.ui.init(this);
    await this.fetchExchangeRate();
    this.startExchangeRateUpdater();
    await this.fetchInitialData();
    this.connectWebSocket();
    this.startTimeSync();
    this.startClock();
  }

  async fetchExchangeRate() {
    try {
      // Try to fetch from multiple sources for reliability
      const sources = [
        'https://api.exchangerate-api.com/v4/latest/USD',
        'https://open.er-api.com/v6/latest/USD',
        'https://api.frankfurter.dev/v1/latest?from=USD&to=IDR'
      ];

      for (const source of sources) {
        try {
          const res = await fetch(source);
          const data = await res.json();
          let rate = null;
          
          if (data.rates?.IDR) rate = data.rates.IDR;
          else if (data.rates?.idr) rate = data.rates.idr;
          else if (data.rates?.[0]?.rate) rate = data.rates[0].rate;
          
          if (rate && rate > 10000 && rate < 20000) {
            this.usdToIdrRate = rate;
            console.log(`[Exchange Rate] 1 USD = ${rate.toLocaleString()} IDR (from ${source})`);
            this.ui.updateExchangeRateDisplay(this.usdToIdrRate);
            this.elements.currencySelector?.style.display = 'block';
            break;
          }
        } catch (e) {
          console.warn(`[Exchange Rate] Failed to fetch from ${source}:`, e.message);
        }
      }
    } catch (err) {
      console.warn('[Exchange Rate] All sources failed, using fallback:', this.usdToIdrRate);
    }
  }

  startExchangeRateUpdater() {
    // Update exchange rate every 30 minutes
    this.rateUpdateInterval = setInterval(() => this.fetchExchangeRate(), 30 * 60 * 1000);
  }

  setCurrency(currency) {
    if (currency !== 'USD' && currency !== 'IDR') return;
    this.currency = currency;
    this.ui.setCurrency(currency);
    this.ui.renderAll(this.data);
    this.charts.update(this.data);
    localStorage.setItem('portfolio-currency', currency);
    
    // Show/hide exchange rate display
    const rateDisplay = document.getElementById('exchange-rate-display');
    if (rateDisplay) {
      rateDisplay.style.display = currency === 'IDR' ? 'inline' : 'none';
    }
  }

  getCurrency() {
    return this.currency;
  }

  getExchangeRate() {
    return this.usdToIdrRate;
  }

  formatCurrency(num, decimals = 2) {
    return formatCurrency(num, decimals, this.currency, this.usdToIdrRate);
  }

  async fetchInitialData() {
    try {
      this.ui.showLoading(true);
      
      const [balances, positions, trades, unrealized, realized, prices, ticker] = await Promise.allSettled([
        this.api('/api/account/balances'),
        this.api('/api/positions'),
        this.api('/api/trades?limit=100'),
        this.api('/api/pnl/unrealized'),
        this.api('/api/pnl/realized'),
        this.api('/api/market/prices'),
        this.api('/api/market/ticker/24hr')
      ]);

      if (balances.status === 'fulfilled') this.data.balances = balances.value.data || [];
      if (positions.status === 'fulfilled') this.data.positions = positions.value.data || [];
      if (trades.status === 'fulfilled') this.data.trades = trades.value.data || [];
      if (unrealized.status === 'fulfilled') this.data.unrealizedPnL = unrealized.value.data || { total: 0, bySymbol: {}, positions: [] };
      if (realized.status === 'fulfilled') this.data.realizedPnL = realized.value.data || { totalRealized: 0, totalFunding: 0, totalCommission: 0, netPnL: 0, bySymbol: {} };
      if (prices.status === 'fulfilled') this.data.prices = prices.value.data || [];
      if (ticker.status === 'fulfilled') this.data.ticker24hr = ticker.value.data || [];

      this.ui.renderAll(this.data);
      this.charts.init(this.data);
      this.ui.showLoading(false);
      
      this.showToast('Dashboard initialized', 'success');
    } catch (err) {
      console.error('Initial data fetch failed:', err);
      this.ui.showLoading(false);
      this.showToast('Failed to load initial data', 'error');
    }
  }

  connectWebSocket() {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}`;
    
    this.ws = new WebSocket(wsUrl);
    
    this.ws.onopen = () => {
      console.log('[WS] Connected');
      this.isConnected = true;
      this.reconnectAttempts = 0;
      this.ui.setConnectionStatus('connected', 'LIVE');
      this.ws.send(JSON.stringify({ type: 'subscribe', channels: ['all'] }));
      this.showToast('Real-time connected', 'success');
    };

    this.ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        this.handleWebSocketMessage(msg);
      } catch (err) {
        console.error('[WS] Parse error:', err);
      }
    };

    this.ws.onclose = () => {
      console.log('[WS] Disconnected');
      this.isConnected = false;
      this.ui.setConnectionStatus('disconnected', 'OFFLINE');
      this.scheduleReconnect();
    };

    this.ws.onerror = (err) => {
      console.error('[WS] Error:', err);
      this.ui.setConnectionStatus('disconnected', 'ERROR');
    };
  }

  scheduleReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      this.showToast('Max reconnection attempts reached', 'error');
      return;
    }
    
    this.reconnectAttempts++;
    const delay = this.reconnectDelay * Math.min(this.reconnectAttempts, 5);
    this.ui.setConnectionStatus('connecting', `RECONNECTING (${this.reconnectAttempts}/${this.maxReconnectAttempts})...`);
    
    setTimeout(() => this.connectWebSocket(), delay);
  }

  handleWebSocketMessage(msg) {
    switch (msg.type) {
      case 'welcome':
        this.lastPing = Date.now();
        break;
      case 'pong':
        this.latency = Date.now() - this.lastPing;
        this.ui.updateLatency(this.latency);
        break;
      case 'snapshot':
        this.data.balances = msg.data.balances || this.data.balances;
        this.data.positions = msg.data.positions || this.data.positions;
        this.data.trades = msg.data.trades || this.data.trades;
        this.data.unrealizedPnL = msg.data.unrealizedPnL || this.data.unrealizedPnL;
        this.data.realizedPnL = msg.data.realizedPnL || this.data.realizedPnL;
        this.data.prices = msg.data.prices || this.data.prices;
        this.data.ticker24hr = msg.data.ticker24hr || this.data.ticker24hr;
        this.data.lastUpdate = msg.data.lastUpdate || Date.now();
        this.ui.renderAll(this.data);
        this.charts.update(this.data);
        break;
      case 'balances':
        this.data.balances = msg.data;
        this.data.lastUpdate = Date.now();
        this.ui.renderBalances(this.data);
        this.ui.renderOverview(this.data);
        this.charts.updateAllocation(this.data);
        break;
      case 'positions':
        this.data.positions = msg.data;
        this.data.lastUpdate = Date.now();
        this.ui.renderPositions(this.data);
        this.ui.renderOverview(this.data);
        break;
      case 'trades':
        this.data.trades = msg.data;
        this.ui.renderTrades(this.data);
        break;
      case 'unrealizedPnL':
        this.data.unrealizedPnL = msg.data;
        this.ui.renderUnrealizedPnL(this.data);
        this.ui.renderOverview(this.data);
        break;
      case 'realizedPnL':
        this.data.realizedPnL = msg.data;
        this.ui.renderRealizedPnL(this.data);
        this.ui.renderOverview(this.data);
        break;
      case 'prices':
        this.data.prices = msg.data;
        this.ui.updatePrices(this.data);
        break;
      case 'ticker24hr':
        this.data.ticker24hr = msg.data;
        this.ui.renderMarket(this.data);
        break;
      case 'error':
        console.error('[WS] Server error:', msg.message);
        this.showToast(msg.message, 'error');
        break;
    }
    this.ui.updateLastUpdate(this.data.lastUpdate);
  }

  async api(endpoint) {
    const response = await fetch(endpoint);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response.json();
  }

  startTimeSync() {
    setInterval(async () => {
      try {
        const start = Date.now();
        const res = await fetch('/api/health');
        const end = Date.now();
        const data = await res.json();
        this.data.serverTimeOffset = data.timestamp - (start + end) / 2;
      } catch (err) {
        console.error('Time sync failed:', err);
      }
    }, 60000);
  }

  startClock() {
    const updateClock = () => {
      const now = new Date(Date.now() + this.data.serverTimeOffset);
      const utc = now.toISOString().substr(11, 8);
      this.ui.updateClock(utc);
    };
    updateClock();
    setInterval(updateClock, 1000);
  }

  showToast(message, type = 'info') {
    this.ui.showToast(message, type);
  }

  refresh() {
    this.fetchInitialData();
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: 'getSnapshot' }));
    }
  }

  getPrice(symbol) {
    const priceData = this.data.prices.find(p => p.symbol === symbol);
    return priceData ? parseFloat(priceData.price) : null;
  }

  getTicker24hr(symbol) {
    return this.data.ticker24hr.find(t => t.symbol === symbol);
  }

  calculatePortfolioValue() {
    let total = 0;
    for (const balance of this.data.balances) {
      if (balance.total > 0) {
        let price = 1;
        if (balance.asset !== 'USDT' && balance.asset !== 'USDC' && balance.asset !== 'BUSD') {
          const pair = `${balance.asset}USDT`;
          price = this.getPrice(pair) || 1;
        }
        total += balance.total * price;
      }
    }
    for (const pos of this.data.positions) {
      total += pos.notional || 0;
    }
    return total;
  }
}

document.addEventListener('DOMContentLoaded', () => {
  window.dashboard = new PortfolioDashboard();
});

export { PortfolioDashboard };