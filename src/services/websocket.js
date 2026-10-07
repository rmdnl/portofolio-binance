export class WebSocketManager {
  constructor(wss, portfolioService) {
    this.wss = wss;
    this.portfolio = portfolioService;
    this.clients = new Set();
    this.pingInterval = parseInt(process.env.WS_PING_INTERVAL) || 30000;
    
    this.setupServer();
    this.bindPortfolioEvents();
    this.startPingInterval();
  }

  setupServer() {
    this.wss.on('connection', (ws, req) => {
      const clientIp = req.socket.remoteAddress;
      console.log(`[WS] Client connected: ${clientIp} (Total: ${this.clients.size + 1})`);
      
      this.clients.add(ws);
      ws.isAlive = true;
      ws.clientIp = clientIp;
      
      ws.on('pong', () => { ws.isAlive = true; });
      
      ws.on('message', (data) => {
        try {
          const msg = JSON.parse(data.toString());
          this.handleMessage(ws, msg);
        } catch (e) {
          ws.send(JSON.stringify({ type: 'error', message: 'Invalid JSON' }));
        }
      });

      ws.on('close', () => {
        this.clients.delete(ws);
        console.log(`[WS] Client disconnected: ${clientIp} (Total: ${this.clients.size})`);
      });

      ws.on('error', (err) => {
        console.error('[WS] Client error:', err.message);
        this.clients.delete(ws);
      });

      this.sendInitialData(ws);
    });
  }

  bindPortfolioEvents() {
    this.portfolio.on('balances', (data) => this.broadcast({ type: 'balances', data }));
    this.portfolio.on('positions', (data) => this.broadcast({ type: 'positions', data }));
    this.portfolio.on('trades', (data) => this.broadcast({ type: 'trades', data: data.slice(0, 20) }));
    this.portfolio.on('unrealizedPnL', (data) => this.broadcast({ type: 'unrealizedPnL', data }));
    this.portfolio.on('realizedPnL', (data) => this.broadcast({ type: 'realizedPnL', data }));
    this.portfolio.on('prices', (data) => this.broadcast({ type: 'prices', data: data.slice(0, 50) }));
    this.portfolio.on('ticker24hr', (data) => this.broadcast({ type: 'ticker24hr', data: data.slice(0, 30) }));
  }

  startPingInterval() {
    setInterval(() => {
      this.clients.forEach(ws => {
        if (!ws.isAlive) {
          this.clients.delete(ws);
          return ws.terminate();
        }
        ws.isAlive = false;
        ws.ping();
      });
    }, this.pingInterval);
  }

  handleMessage(ws, msg) {
    switch (msg.type) {
      case 'ping':
        ws.send(JSON.stringify({ type: 'pong', timestamp: Date.now() }));
        break;
      case 'subscribe':
        ws.subscriptions = msg.channels || ['all'];
        ws.send(JSON.stringify({ type: 'subscribed', channels: ws.subscriptions }));
        break;
      case 'getSnapshot':
        this.sendSnapshot(ws, msg.channels);
        break;
      default:
        ws.send(JSON.stringify({ type: 'error', message: `Unknown message type: ${msg.type}` }));
    }
  }

  async sendInitialData(ws) {
    ws.send(JSON.stringify({
      type: 'welcome',
      timestamp: Date.now(),
      serverTime: Date.now()
    }));

    await this.sendSnapshot(ws);
  }

  async sendSnapshot(ws, channels = ['all']) {
    const snapshot = {};
    
    if (channels.includes('all') || channels.includes('balances')) {
      snapshot.balances = this.portfolio.getBalances();
    }
    if (channels.includes('all') || channels.includes('positions')) {
      snapshot.positions = this.portfolio.getPositions();
    }
    if (channels.includes('all') || channels.includes('trades')) {
      snapshot.trades = this.portfolio.getTrades(null, 20);
    }
    if (channels.includes('all') || channels.includes('unrealizedPnL')) {
      snapshot.unrealizedPnL = this.portfolio.getUnrealizedPnL();
    }
    if (channels.includes('all') || channels.includes('realizedPnL')) {
      snapshot.realizedPnL = this.portfolio.getRealizedPnL();
    }
    if (channels.includes('all') || channels.includes('prices')) {
      snapshot.prices = this.portfolio.getCachedPrices().slice(0, 50);
    }
    if (channels.includes('all') || channels.includes('ticker24hr')) {
      snapshot.ticker24hr = this.portfolio.getCachedTicker24hr().slice(0, 30);
    }

    snapshot.lastUpdate = this.portfolio.getLastUpdate();
    snapshot.timestamp = Date.now();

    ws.send(JSON.stringify({ type: 'snapshot', data: snapshot }));
  }

  broadcast(message) {
    const data = JSON.stringify(message);
    this.clients.forEach(ws => {
      if (ws.readyState === 1) {
        try {
          ws.send(data);
        } catch (e) {
          this.clients.delete(ws);
        }
      }
    });
  }

  getClientCount() {
    return this.clients.size;
  }
}