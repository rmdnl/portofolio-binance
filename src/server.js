import express from 'express';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import compression from 'compression';
import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';

import { BinanceService } from './services/binance.js';
import { PortfolioService } from './services/portfolio.js';
import { WebSocketManager } from './services/websocket.js';
import { apiLimiter } from './middleware/rateLimit.js';
import { errorHandler } from './middleware/errorHandler.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '../config/.env') });

const app = express();
const server = createServer(app);
const wss = new WebSocketServer({ server });

const PORT = process.env.PORT || 8081;
const NODE_ENV = process.env.NODE_ENV || 'production';

const binanceService = new BinanceService();
const portfolioService = new PortfolioService(binanceService);
const wsManager = new WebSocketManager(wss, portfolioService);

app.use(helmet({
  contentSecurityPolicy: NODE_ENV === 'production' ? {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", 'https://cdn.jsdelivr.net', 'https://static.cloudflareinsights.com'],
      styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
      fontSrc: ["'self'", 'https://fonts.gstatic.com'],
      imgSrc: ["'self'", 'data:', 'https:'],
      connectSrc: ["'self'", 'ws:', 'wss:', 'https://api.exchangerate-api.com', 'https://open.er-api.com', 'https://api.frankfurter.dev'],
      workerSrc: ["'self'", 'blob:'],
    }
  } : false,
  crossOriginEmbedderPolicy: false
}));

app.use(cors({
  origin: NODE_ENV === 'production' ? false : '*',
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(compression());
app.use(express.json());
app.use(apiLimiter);

app.use(express.static(join(__dirname, '../public'), {
  maxAge: NODE_ENV === 'production' ? '1d' : 0,
  etag: true
}));

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: Date.now(), uptime: process.uptime() });
});

app.get('/api/account/info', async (req, res, next) => {
  try {
    const data = await portfolioService.getAccountInfo();
    res.json({ success: true, data, timestamp: Date.now() });
  } catch (err) {
    next(err);
  }
});

app.get('/api/account/balances', async (req, res, next) => {
  try {
    const data = await portfolioService.getBalances();
    res.json({ success: true, data, timestamp: Date.now() });
  } catch (err) {
    next(err);
  }
});

app.get('/api/positions', async (req, res, next) => {
  try {
    const data = await portfolioService.getPositions();
    res.json({ success: true, data, timestamp: Date.now() });
  } catch (err) {
    next(err);
  }
});

app.get('/api/trades', async (req, res, next) => {
  try {
    const { symbol, limit = 50 } = req.query;
    const data = await portfolioService.getTrades(symbol, parseInt(limit));
    res.json({ success: true, data, timestamp: Date.now() });
  } catch (err) {
    next(err);
  }
});

app.get('/api/pnl/unrealized', async (req, res, next) => {
  try {
    const data = await portfolioService.getUnrealizedPnL();
    res.json({ success: true, data, timestamp: Date.now() });
  } catch (err) {
    next(err);
  }
});

app.get('/api/pnl/realized', async (req, res, next) => {
  try {
    const { startTime, endTime } = req.query;
    const data = await portfolioService.getRealizedPnL(startTime, endTime);
    res.json({ success: true, data, timestamp: Date.now() });
  } catch (err) {
    next(err);
  }
});

app.get('/api/market/prices', async (req, res, next) => {
  try {
    const data = await binanceService.getAllPrices();
    res.json({ success: true, data, timestamp: Date.now() });
  } catch (err) {
    next(err);
  }
});

app.get('/api/market/ticker/24hr', async (req, res, next) => {
  try {
    const data = await binanceService.get24hrTicker();
    res.json({ success: true, data, timestamp: Date.now() });
  } catch (err) {
    next(err);
  }
});

app.use((req, res) => {
  res.status(404).json({ success: false, error: 'Not found', path: req.path });
});

app.use(errorHandler);

server.listen(PORT, '0.0.0.0', () => {
  console.log(`
╔══════════════════════════════════════════════════════════════╗
║  PORTFOLIO DASHBOARD - RETROFUTURE EDITION                  ║
║  ████████████████████████████████████████████████████████████  ║
║  Server running on http://0.0.0.0:${PORT}                      ║
║  WebSocket: ws://0.0.0.0:${PORT}                               ║
║  Environment: ${NODE_ENV}                                        ║
║  Binance: ${process.env.BINANCE_TESTNET === 'true' ? 'TESTNET' : 'MAINNET'}                            ║
╚══════════════════════════════════════════════════════════════╝
  `);

  portfolioService.startAutoRefresh();
});

process.on('SIGTERM', () => {
  console.log('SIGTERM received. Shutting down gracefully...');
  portfolioService.stopAutoRefresh();
  server.close(() => {
    console.log('Server closed.');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('SIGINT received. Shutting down gracefully...');
  portfolioService.stopAutoRefresh();
  server.close(() => {
    console.log('Server closed.');
    process.exit(0);
  });
});

export { app, server, wss, portfolioService, wsManager };