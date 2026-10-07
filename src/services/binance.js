import axios from 'axios';
import crypto from 'crypto';

const BASE_URL = process.env.BINANCE_TESTNET === 'true' 
  ? 'https://testnet.binance.vision' 
  : 'https://api.binance.com';

const FUTURES_BASE_URL = process.env.BINANCE_TESTNET === 'true'
  ? 'https://testnet.binancefuture.com'
  : 'https://fapi.binance.com';

class BinanceService {
  constructor() {
    this.apiKey = process.env.BINANCE_API_KEY;
    this.apiSecret = process.env.BINANCE_API_SECRET;
    
    this.client = axios.create({
      baseURL: BASE_URL,
      timeout: 10000,
      headers: {
        'X-MBX-APIKEY': this.apiKey,
        'Content-Type': 'application/json'
      }
    });

    this.futuresClient = axios.create({
      baseURL: FUTURES_BASE_URL,
      timeout: 10000,
      headers: {
        'X-MBX-APIKEY': this.apiKey,
        'Content-Type': 'application/json'
      }
    });

    this.priceCache = new Map();
    this.priceCacheExpiry = 0;
  }

  signParams(params) {
    const queryString = new URLSearchParams(params).toString();
    const signature = crypto
      .createHmac('sha256', this.apiSecret)
      .update(queryString)
      .digest('hex');
    return `${queryString}&signature=${signature}`;
  }

  async signedRequest(client, method, endpoint, params = {}) {
    const timestamp = Date.now();
    const queryParams = { ...params, timestamp, recvWindow: 5000 };
    const signedQuery = this.signParams(queryParams);
    
    const config = {
      method,
      url: `${endpoint}?${signedQuery}`,
      headers: { 'X-MBX-APIKEY': this.apiKey }
    };

    const response = await client.request(config);
    return response.data;
  }

  async getAccountInfo() {
    return this.signedRequest(this.client, 'GET', '/api/v3/account');
  }

  async getFuturesAccountInfo() {
    return this.signedRequest(this.futuresClient, 'GET', '/fapi/v2/account');
  }

  async getFuturesPositions() {
    return this.signedRequest(this.futuresClient, 'GET', '/fapi/v2/positionRisk');
  }

  async getSpotTrades(symbol, limit = 50) {
    const params = { symbol, limit: Math.min(limit, 100) };
    return this.signedRequest(this.client, 'GET', '/api/v3/myTrades', params);
  }

  async getFuturesTrades(symbol, limit = 50) {
    const params = { symbol, limit: Math.min(limit, 100) };
    return this.signedRequest(this.futuresClient, 'GET', '/fapi/v1/userTrades', params);
  }

  async getIncomeHistory(symbol, incomeType, limit = 100) {
    const params = { 
      symbol, 
      incomeType, 
      limit: Math.min(limit, 1000),
      startTime: Date.now() - 30 * 24 * 60 * 60 * 1000
    };
    return this.signedRequest(this.futuresClient, 'GET', '/fapi/v1/income', params);
  }

  async getAllPrices() {
    const now = Date.now();
    if (this.priceCache.size > 0 && now < this.priceCacheExpiry) {
      return Array.from(this.priceCache.entries()).map(([symbol, price]) => ({
        symbol,
        price: price.toString()
      }));
    }

    const [spotPrices, futuresPrices] = await Promise.allSettled([
      this.client.get('/api/v3/ticker/price'),
      this.futuresClient.get('/fapi/v1/ticker/price')
    ]);

    const prices = [];
    
    if (spotPrices.status === 'fulfilled') {
      spotPrices.value.data.forEach(p => {
        this.priceCache.set(p.symbol, parseFloat(p.price));
        prices.push(p);
      });
    }
    
    if (futuresPrices.status === 'fulfilled') {
      futuresPrices.value.data.forEach(p => {
        this.priceCache.set(p.symbol, parseFloat(p.price));
        prices.push(p);
      });
    }

    this.priceCacheExpiry = now + 2000;
    return prices;
  }

  async getPrice(symbol) {
    await this.getAllPrices();
    return this.priceCache.get(symbol) || null;
  }

  async get24hrTicker() {
    const [spotTicker, futuresTicker] = await Promise.allSettled([
      this.client.get('/api/v3/ticker/24hr'),
      this.futuresClient.get('/fapi/v1/ticker/24hr')
    ]);

    const tickers = [];
    if (spotTicker.status === 'fulfilled') tickers.push(...spotTicker.value.data);
    if (futuresTicker.status === 'fulfilled') tickers.push(...futuresTicker.value.data);
    return tickers;
  }

  async getKlines(symbol, interval = '1h', limit = 100) {
    const params = { symbol, interval, limit };
    const response = await this.client.get('/api/v3/klines', { params });
    return response.data;
  }

  validateCredentials() {
    return !!(this.apiKey && this.apiSecret && 
      this.apiKey !== 'your_read_only_api_key_here' &&
      this.apiSecret !== 'your_read_only_api_secret_here');
  }
}

export { BinanceService };