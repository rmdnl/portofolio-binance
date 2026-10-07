import { EventEmitter } from 'events';

class PortfolioService extends EventEmitter {
  constructor(binanceService) {
    super();
    this.binance = binanceService;
    this.cache = {
      accountInfo: null,
      balances: null,
      positions: null,
      trades: null,
      unrealizedPnL: null,
      realizedPnL: null,
      prices: null,
      ticker24hr: null,
      lastUpdate: 0
    };
    this.refreshIntervals = {};
    this.isRefreshing = false;
  }

  startAutoRefresh() {
    const balanceMs = parseInt(process.env.BALANCE_REFRESH_MS) || 5000;
    const tradesMs = parseInt(process.env.TRADES_REFRESH_MS) || 10000;
    const pnlMs = parseInt(process.env.PNL_REFRESH_MS) || 10000;
    const priceMs = parseInt(process.env.PRICE_REFRESH_MS) || 2000;

    this.refreshIntervals.balances = setInterval(() => this.refreshBalances(), balanceMs);
    this.refreshIntervals.trades = setInterval(() => this.refreshTrades(), tradesMs);
    this.refreshIntervals.pnl = setInterval(() => this.refreshPnL(), pnlMs);
    this.refreshIntervals.prices = setInterval(() => this.refreshPrices(), priceMs);

    this.refreshAll();
    console.log('[Portfolio] Auto-refresh started');
  }

  stopAutoRefresh() {
    Object.values(this.refreshIntervals).forEach(id => clearInterval(id));
    this.refreshIntervals = {};
    console.log('[Portfolio] Auto-refresh stopped');
  }

  async refreshAll() {
    await Promise.allSettled([
      this.refreshBalances(),
      this.refreshTrades(),
      this.refreshPnL(),
      this.refreshPrices()
    ]);
  }

  async refreshBalances() {
    if (this.isRefreshing) return;
    this.isRefreshing = true;
    
    try {
      const [spotAccount, futuresAccount, futuresPositions] = await Promise.allSettled([
        this.binance.getAccountInfo(),
        this.binance.getFuturesAccountInfo(),
        this.binance.getFuturesPositions()
      ]);

      this.cache.accountInfo = spotAccount.status === 'fulfilled' ? spotAccount.value : null;
      this.cache.balances = this.parseBalances(spotAccount, futuresAccount);
      this.cache.positions = futuresPositions.status === 'fulfilled' ? this.parsePositions(futuresPositions.value) : [];
      this.cache.lastUpdate = Date.now();
      
      this.emit('balances', this.cache.balances);
      this.emit('positions', this.cache.positions);
    } catch (err) {
      console.error('[Portfolio] Balance refresh error:', err.message);
    } finally {
      this.isRefreshing = false;
    }
  }

  parseBalances(spotResult, futuresResult) {
    const balances = [];
    const seen = new Set();

    if (spotResult.status === 'fulfilled') {
      spotResult.value.balances.forEach(b => {
        const free = parseFloat(b.free);
        const locked = parseFloat(b.locked);
        const total = free + locked;
        if (total > 0) {
          balances.push({
            asset: b.asset,
            free,
            locked,
            total,
            type: 'SPOT'
          });
          seen.add(b.asset);
        }
      });
    }

    if (futuresResult.status === 'fulfilled') {
      futuresResult.value.assets.forEach(a => {
        const walletBalance = parseFloat(a.walletBalance);
        const crossWalletBalance = parseFloat(a.crossWalletBalance);
        const availableBalance = parseFloat(a.availableBalance);
        const total = walletBalance + crossWalletBalance;
        if (total > 0) {
          if (!seen.has(a.asset)) {
            balances.push({
              asset: a.asset,
              free: availableBalance,
              locked: total - availableBalance,
              total,
              type: 'FUTURES'
            });
          } else {
            const existing = balances.find(b => b.asset === a.asset);
            if (existing) {
              existing.free += availableBalance;
              existing.locked += total - availableBalance;
              existing.total += total;
              existing.type = 'BOTH';
            }
          }
        }
      });
    }

    return balances.sort((a, b) => b.total - a.total);
  }

  parsePositions(positions) {
    return positions
      .filter(p => parseFloat(p.positionAmt) !== 0)
      .map(p => ({
        symbol: p.symbol,
        positionAmt: parseFloat(p.positionAmt),
        entryPrice: parseFloat(p.entryPrice),
        markPrice: parseFloat(p.markPrice),
        unRealizedProfit: parseFloat(p.unRealizedProfit),
        liquidationPrice: parseFloat(p.liquidationPrice) || null,
        leverage: parseInt(p.leverage),
        marginType: p.marginType,
        isolatedWallet: parseFloat(p.isolatedWallet) || 0,
        side: parseFloat(p.positionAmt) > 0 ? 'LONG' : 'SHORT',
        notional: Math.abs(parseFloat(p.positionAmt) * parseFloat(p.markPrice)),
        roe: parseFloat(p.entryPrice) > 0 
          ? ((parseFloat(p.markPrice) - parseFloat(p.entryPrice)) / parseFloat(p.entryPrice)) * 100 * (parseFloat(p.positionAmt) > 0 ? 1 : -1)
          : 0
      }));
  }

  async refreshTrades() {
    try {
      const positions = this.cache.positions || [];
      const symbols = [...new Set(positions.map(p => p.symbol))];
      
      const spotSymbols = ['BTCUSDT', 'ETHUSDT', 'BNBUSDT', 'SOLUSDT', 'DOGEUSDT', 'XRPUSDT', 'ADAUSDT'];
      const allSymbols = [...new Set([...symbols, ...spotSymbols])];

      const trades = [];
      for (const symbol of allSymbols.slice(0, 10)) {
        try {
          const [spotTrades, futuresTrades] = await Promise.allSettled([
            this.binance.getSpotTrades(symbol, 20),
            this.binance.getFuturesTrades(symbol, 20)
          ]);

          if (spotTrades.status === 'fulfilled') {
            spotTrades.value.forEach(t => trades.push({ ...t, market: 'SPOT', symbol }));
          }
          if (futuresTrades.status === 'fulfilled') {
            futuresTrades.value.forEach(t => trades.push({ ...t, market: 'FUTURES', symbol }));
          }
        } catch (e) {
          // Ignore individual symbol errors
        }
      }

      trades.sort((a, b) => b.time - a.time);
      this.cache.trades = trades.slice(0, 100);
      this.emit('trades', this.cache.trades);
    } catch (err) {
      console.error('[Portfolio] Trades refresh error:', err.message);
    }
  }

  async refreshPnL() {
    try {
      const [unrealized, realized] = await Promise.allSettled([
        this.calculateUnrealizedPnL(),
        this.calculateRealizedPnL()
      ]);

      if (unrealized.status === 'fulfilled') {
        this.cache.unrealizedPnL = unrealized.value;
        this.emit('unrealizedPnL', this.cache.unrealizedPnL);
      }
      if (realized.status === 'fulfilled') {
        this.cache.realizedPnL = realized.value;
        this.emit('realizedPnL', this.cache.realizedPnL);
      }
    } catch (err) {
      console.error('[Portfolio] PnL refresh error:', err.message);
    }
  }

  async calculateUnrealizedPnL() {
    const positions = this.cache.positions || [];
    let totalUnrealized = 0;
    const bySymbol = {};

    for (const pos of positions) {
      totalUnrealized += pos.unRealizedProfit;
      if (!bySymbol[pos.symbol]) bySymbol[pos.symbol] = 0;
      bySymbol[pos.symbol] += pos.unRealizedProfit;
    }

    return {
      total: totalUnrealized,
      bySymbol,
      positions: positions.map(p => ({
        symbol: p.symbol,
        side: p.side,
        size: Math.abs(p.positionAmt),
        entryPrice: p.entryPrice,
        markPrice: p.markPrice,
        unrealizedPnL: p.unRealizedProfit,
        roe: p.roe,
        liquidationPrice: p.liquidationPrice
      }))
    };
  }

  async calculateRealizedPnL(startTime, endTime) {
    const start = startTime ? parseInt(startTime) : Date.now() - 30 * 24 * 60 * 60 * 1000;
    const end = endTime ? parseInt(endTime) : Date.now();

    try {
      const [realizedPnl, fundingFees, commissions] = await Promise.allSettled([
        this.binance.getIncomeHistory(null, 'REALIZED_PNL', 1000),
        this.binance.getIncomeHistory(null, 'FUNDING_FEE', 1000),
        this.binance.getIncomeHistory(null, 'COMMISSION', 1000)
      ]);

      const pnlData = realizedPnl.status === 'fulfilled' ? realizedPnl.value : [];
      const fundingData = fundingFees.status === 'fulfilled' ? fundingFees.value : [];
      const commissionData = commissions.status === 'fulfilled' ? commissions.value : [];

      const filteredPnl = pnlData.filter(i => i.time >= start && i.time <= end);
      const filteredFunding = fundingData.filter(i => i.time >= start && i.time <= end);
      const filteredCommission = commissionData.filter(i => i.time >= start && i.time <= end);

      const totalRealized = filteredPnl.reduce((sum, i) => sum + parseFloat(i.income), 0);
      const totalFunding = filteredFunding.reduce((sum, i) => sum + parseFloat(i.income), 0);
      const totalCommission = filteredCommission.reduce((sum, i) => sum + parseFloat(i.income), 0);

      const bySymbol = {};
      [...filteredPnl, ...filteredFunding, ...filteredCommission].forEach(i => {
        if (!bySymbol[i.symbol]) bySymbol[i.symbol] = { realized: 0, funding: 0, commission: 0, count: 0 };
        if (i.incomeType === 'REALIZED_PNL') bySymbol[i.symbol].realized += parseFloat(i.income);
        else if (i.incomeType === 'FUNDING_FEE') bySymbol[i.symbol].funding += parseFloat(i.income);
        else if (i.incomeType === 'COMMISSION') bySymbol[i.symbol].commission += parseFloat(i.income);
        bySymbol[i.symbol].count++;
      });

      return {
        totalRealized,
        totalFunding,
        totalCommission,
        netPnL: totalRealized + totalFunding + totalCommission,
        bySymbol,
        period: { start, end },
        tradesCount: filteredPnl.length
      };
    } catch (err) {
      console.error('[Portfolio] Realized PnL error:', err.message);
      return {
        totalRealized: 0,
        totalFunding: 0,
        totalCommission: 0,
        netPnL: 0,
        bySymbol: {},
        period: { start, end },
        tradesCount: 0
      };
    }
  }

  async refreshPrices() {
    try {
      const [prices, ticker24hr] = await Promise.allSettled([
        this.binance.getAllPrices(),
        this.binance.get24hrTicker()
      ]);

      if (prices.status === 'fulfilled') {
        this.cache.prices = prices.value;
        this.emit('prices', this.cache.prices);
      }
      if (ticker24hr.status === 'fulfilled') {
        this.cache.ticker24hr = ticker24hr.value;
        this.emit('ticker24hr', this.cache.ticker24hr);
      }
    } catch (err) {
      console.error('[Portfolio] Price refresh error:', err.message);
    }
  }

  getAccountInfo() {
    if (!this.cache.accountInfo) throw new Error('Account info not loaded yet');
    return this.cache.accountInfo;
  }

  getBalances() {
    if (!this.cache.balances) throw new Error('Balances not loaded yet');
    return this.cache.balances;
  }

  getPositions() {
    return this.cache.positions || [];
  }

  getTrades(symbol, limit) {
    let trades = this.cache.trades || [];
    if (symbol) trades = trades.filter(t => t.symbol === symbol);
    return trades.slice(0, limit);
  }

  getUnrealizedPnL() {
    return this.cache.unrealizedPnL || { total: 0, bySymbol: {}, positions: [] };
  }

  getRealizedPnL(startTime, endTime) {
    return this.calculateRealizedPnL(startTime, endTime);
  }

  getCachedPrices() {
    return this.cache.prices || [];
  }

  getCachedTicker24hr() {
    return this.cache.ticker24hr || [];
  }

  getLastUpdate() {
    return this.cache.lastUpdate;
  }
}

export { PortfolioService };