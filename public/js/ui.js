export class UIManager {
  constructor() {
    this.currentTab = 'overview';
    this.toastContainer = null;
    this.elements = {};
  }

  init(dashboard) {
    this.dashboard = dashboard;
    this.cacheElements();
    this.bindEvents();
    this.toastContainer = document.getElementById('toast-container');
    
    // Load saved currency preference
    const savedCurrency = localStorage.getItem('portfolio-currency') || 'USD';
    this.dashboard.setCurrency(savedCurrency);
  }

  cacheElements() {
    this.elements = {
      connectionStatus: document.getElementById('connection-status'),
      connectionDot: document.querySelector('#connection-status .status-dot'),
      connectionText: document.querySelector('#connection-status .status-text'),
      apiStatusDot: document.getElementById('api-status-dot'),
      apiStatusText: document.getElementById('api-status-text'),
      timeDisplay: document.getElementById('time-display'),
      serverTime: document.getElementById('server-time'),
      totalValue: document.getElementById('total-value'),
      totalChange: document.getElementById('total-change'),
      wsLatency: document.getElementById('ws-latency'),
      lastUpdate: document.getElementById('last-update'),
      btnRefresh: document.getElementById('btn-refresh'),
      sidebar: document.getElementById('sidebar'),
      content: document.getElementById('content'),
      navItems: document.querySelectorAll('.nav-item'),
      tabPanels: document.querySelectorAll('.tab-panel'),
      allocView: document.getElementById('alloc-view'),
      pnlView: document.getElementById('pnl-view'),
      balanceFilter: document.getElementById('balance-filter'),
      tradeMarketFilter: document.getElementById('trade-market-filter'),
      tradeSymbolFilter: document.getElementById('trade-symbol-filter'),
      marketSearch: document.getElementById('market-search'),
      marketSort: document.getElementById('market-sort'),
      mobileMenuBtn: document.getElementById('mobile-menu-btn'),
      sidebarOverlay: document.getElementById('sidebar-overlay'),
      currencySelector: document.getElementById('currency-selector'),
      exchangeRateDisplay: document.getElementById('exchange-rate-display'),
    };
  }

  bindEvents() {
    this.elements.navItems.forEach(item => {
      item.addEventListener('click', () => this.switchTab(item.dataset.tab));
    });

    this.elements.btnRefresh.addEventListener('click', () => this.dashboard.refresh());

    // Mobile menu toggle
    this.elements.mobileMenuBtn?.addEventListener('click', () => this.toggleSidebar());
    this.elements.sidebarOverlay?.addEventListener('click', () => this.closeSidebar());

    // Currency selector
    this.elements.currencySelector?.addEventListener('change', (e) => {
      this.dashboard.setCurrency(e.target.value);
    });

    this.elements.allocView?.addEventListener('change', () => this.dashboard.charts.updateAllocation(this.dashboard.data));
    this.elements.pnlView?.addEventListener('change', () => this.dashboard.charts.updatePnLTimeline(this.dashboard.data));
    this.elements.balanceFilter?.addEventListener('change', () => this.renderBalances(this.dashboard.data));
    this.elements.tradeMarketFilter?.addEventListener('change', () => this.renderTrades(this.dashboard.data));
    this.elements.tradeSymbolFilter?.addEventListener('change', () => this.renderTrades(this.dashboard.data));
    this.elements.marketSearch?.addEventListener('input', () => this.renderMarket(this.dashboard.data));
    this.elements.marketSort?.addEventListener('change', () => this.renderMarket(this.dashboard.data));

    document.addEventListener('keydown', (e) => {
      if (e.key === 'r' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        this.dashboard.refresh();
      }
      if (e.key === 'Escape') {
        this.closeSidebar();
      }
    });

    // Close sidebar on nav click (mobile)
    this.elements.navItems.forEach(item => {
      item.addEventListener('click', () => this.closeSidebar());
    });
  }

  toggleSidebar() {
    const isOpen = this.elements.sidebar.classList.toggle('open');
    this.elements.sidebarOverlay.classList.toggle('visible', isOpen);
    this.elements.mobileMenuBtn.setAttribute('aria-expanded', isOpen);
    this.elements.sidebarOverlay.setAttribute('aria-hidden', !isOpen);
  }

  closeSidebar() {
    this.elements.sidebar.classList.remove('open');
    this.elements.sidebarOverlay.classList.remove('visible');
    this.elements.mobileMenuBtn.setAttribute('aria-expanded', 'false');
    this.elements.sidebarOverlay.setAttribute('aria-hidden', 'true');
  }

  switchTab(tabName) {
    this.currentTab = tabName;
    
    this.elements.navItems.forEach(item => {
      item.classList.toggle('active', item.dataset.tab === tabName);
    });
    
    this.elements.tabPanels.forEach(panel => {
      panel.classList.toggle('active', panel.id === `tab-${tabName}`);
    });

    if (tabName === 'overview') {
      this.dashboard.charts.updateAllocation(this.dashboard.data);
      this.dashboard.charts.updatePnLTimeline(this.dashboard.data);
    }
    
    this.closeSidebar();
  }

  setConnectionStatus(status, text) {
    this.elements.connectionStatus.className = `status-badge ${status}`;
    this.elements.connectionText.textContent = text;
    this.elements.apiStatusDot.className = `api-dot ${status === 'connected' ? 'connected' : ''}`;
    this.elements.apiStatusText.textContent = status === 'connected' ? 'BINANCE API ● LIVE' : 'BINANCE API ○ OFFLINE';
  }

  updateClock(time) {
    this.elements.timeDisplay.textContent = `${time} UTC`;
  }

  updateLatency(latency) {
    this.elements.wsLatency.textContent = `WS: ${latency}ms`;
  }

  updateLastUpdate(timestamp) {
    if (timestamp) {
      this.elements.lastUpdate.textContent = `LAST: ${timeAgo(timestamp)}`;
    }
  }

  updateExchangeRateDisplay(rate) {
    if (this.elements.exchangeRateDisplay) {
      this.elements.exchangeRateDisplay.textContent = `1 USD = ${rate.toLocaleString('id-ID')} IDR`;
    }
  }

  setCurrency(currency) {
    if (this.elements.currencySelector) {
      this.elements.currencySelector.value = currency;
    }
  }

  showLoading(show) {
    const loader = document.getElementById('global-loader');
    if (show) {
      if (!loader) {
        const div = document.createElement('div');
        div.id = 'global-loader';
        div.innerHTML = `
          <div class="loader-overlay">
            <div class="loader-spinner"></div>
            <div class="loader-text">INITIALIZING...</div>
          </div>
          <style>
            .loader-overlay { position: fixed; inset: 0; background: var(--bg-primary); z-index: 10000; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 1rem; }
            .loader-spinner { width: 48px; height: 48px; border: 3px solid var(--border-dim); border-top-color: var(--accent-primary); border-radius: 50%; animation: spin 1s linear infinite; }
            .loader-text { font-family: var(--font-display); font-size: 1rem; letter-spacing: 0.2em; color: var(--accent-primary); }
            @keyframes spin { to { transform: rotate(360deg); } }
          </style>
        `;
        document.body.appendChild(div);
      }
    } else {
      if (loader) loader.remove();
    }
  }

  formatCurrency(num, decimals = 2) {
    return this.dashboard.formatCurrency(num, decimals);
  }

  renderAll(data) {
    this.renderOverview(data);
    this.renderBalances(data);
    this.renderPositions(data);
    this.renderTrades(data);
    this.renderUnrealizedPnL(data);
    this.renderRealizedPnL(data);
    this.renderMarket(data);
    this.updateTradeSymbolFilter(data);
  }

  renderOverview(data) {
    const totalValue = this.dashboard.calculatePortfolioValue();
    const unrealized = data.unrealizedPnL?.total || 0;
    const realized = data.realizedPnL?.netPnL || 0;
    const totalChange = totalValue > 0 ? ((unrealized + realized) / (totalValue - unrealized - realized)) * 100 : 0;

    this.elements.totalValue.textContent = this.formatCurrency(totalValue);
    this.elements.totalChange.textContent = `${totalChange >= 0 ? '+' : ''}${totalChange.toFixed(2)}%`;
    this.elements.totalChange.className = `net-worth-change ${totalChange >= 0 ? 'positive' : 'negative'}`;

    document.getElementById('ov-total').textContent = this.formatCurrency(totalValue);
    document.getElementById('ov-total-change').textContent = `${totalChange >= 0 ? '+' : ''}${totalChange.toFixed(2)}%`;
    document.getElementById('ov-total-change').className = `stat-change ${totalChange >= 0 ? 'positive' : 'negative'}`;

    document.getElementById('ov-unrealized').textContent = this.formatCurrency(unrealized);
    document.getElementById('ov-unrealized-change').textContent = `${unrealized >= 0 ? '+' : ''}${this.formatCurrency(unrealized, 2).replace(/^[\$Rp]/, '')}`;
    document.getElementById('ov-unrealized-change').className = `stat-change ${unrealized >= 0 ? 'positive' : 'negative'}`;

    document.getElementById('ov-realized').textContent = this.formatCurrency(realized);
    document.getElementById('ov-realized-change').textContent = `${realized >= 0 ? '+' : ''}${this.formatCurrency(realized, 2).replace(/^[\$Rp]/, '')}`;
    document.getElementById('ov-realized-change').className = `stat-change ${realized >= 0 ? 'positive' : 'negative'}`;

    const trades = data.trades || [];
    const closedTrades = trades.filter(t => t.realizedPnl !== undefined);
    const wins = closedTrades.filter(t => (t.realizedPnl || 0) > 0).length;
    const winRate = closedTrades.length > 0 ? (wins / closedTrades.length) * 100 : 0;
    
    document.getElementById('ov-winrate').textContent = `${winRate.toFixed(1)}%`;
    document.getElementById('ov-winrate-change').textContent = `${wins}/${closedTrades.length}`;
    document.getElementById('ov-winrate-change').className = 'stat-change neutral';

    this.renderTopGainersLosers(data);
  }

  renderTopGainersLosers(data) {
    const positions = data.unrealizedPnL?.positions || [];
    const sorted = [...positions].sort((a, b) => b.unrealizedPnL - a.unrealizedPnL);
    
    const gainers = sorted.filter(p => p.unrealizedPnL > 0).slice(0, 5);
    const losers = sorted.filter(p => p.unrealizedPnL < 0).slice(0, 5).reverse();

    const gainersBody = document.querySelector('#top-gainers tbody');
    const losersBody = document.querySelector('#top-losers tbody');

    gainersBody.innerHTML = gainers.map(p => `
      <tr>
        <td class="symbol-cell">${p.symbol}</td>
        <td class="positive">${this.formatCurrency(p.unrealizedPnL)}</td>
        <td class="positive">${p.roe.toFixed(2)}%</td>
        <td>${formatNumber(p.size)}</td>
      </tr>
    `).join('') || '<tr><td colspan="4" style="text-align:center;color:var(--text-dim);padding:2rem;">No gainers</td></tr>';

    losersBody.innerHTML = losers.map(p => `
      <tr>
        <td class="symbol-cell">${p.symbol}</td>
        <td class="negative">${this.formatCurrency(p.unrealizedPnL)}</td>
        <td class="negative">${p.roe.toFixed(2)}%</td>
        <td>${formatNumber(p.size)}</td>
      </tr>
    `).join('') || '<tr><td colspan="4" style="text-align:center;color:var(--text-dim);padding:2rem;">No losers</td></tr>';
  }

  renderBalances(data) {
    const filter = this.elements.balanceFilter?.value || 'all';
    let balances = data.balances || [];

    if (filter === 'spot') balances = balances.filter(b => b.type === 'SPOT');
    else if (filter === 'futures') balances = balances.filter(b => b.type === 'FUTURES');
    else if (filter === 'non-zero') balances = balances.filter(b => b.total > 0);

    const totalValue = this.dashboard.calculatePortfolioValue();
    const tbody = document.querySelector('#balances-table tbody');

    tbody.innerHTML = balances.map(b => {
      let price = 1;
      let change24h = 0;
      
      if (b.asset !== 'USDT' && b.asset !== 'USDC' && b.asset !== 'BUSD') {
        const pair = `${b.asset}USDT`;
        price = this.dashboard.getPrice(pair) || 1;
        const ticker = this.dashboard.getTicker24hr(pair);
        if (ticker) change24h = parseFloat(ticker.priceChangePercent);
      }
      
      const value = b.total * price;
      const pct = totalValue > 0 ? (value / totalValue) * 100 : 0;

      return `
        <tr>
          <td class="symbol-cell">${b.asset}</td>
          <td><span class="side-badge ${b.type.toLowerCase()}">${b.type}</span></td>
          <td>${formatNumber(b.free)}</td>
          <td>${formatNumber(b.locked)}</td>
          <td><strong>${formatNumber(b.total)}</strong></td>
          <td>${this.formatCurrency(value)}</td>
          <td class="${change24h >= 0 ? 'positive' : 'negative'}">${change24h >= 0 ? '+' : ''}${change24h.toFixed(2)}%</td>
          <td>${pct.toFixed(2)}%</td>
        </tr>
      `;
    }).join('') || '<tr><td colspan="8" style="text-align:center;color:var(--text-dim);padding:2rem;">No balances</td></tr>';
  }

  renderPositions(data) {
    const positions = data.positions || [];
    const tbody = document.querySelector('#positions-table tbody');
    const emptyState = document.getElementById('positions-empty');

    if (positions.length === 0) {
      document.getElementById('positions-table').style.display = 'none';
      emptyState.style.display = 'flex';
      return;
    }

    document.getElementById('positions-table').style.display = 'table';
    emptyState.style.display = 'none';

    tbody.innerHTML = positions.map(p => {
      const liqDist = p.liquidationPrice && p.markPrice > 0 
        ? ((p.markPrice - p.liquidationPrice) / p.markPrice) * 100 * (p.side === 'LONG' ? 1 : -1)
        : null;
      let liqClass = 'safe';
      if (liqDist !== null) {
        if (liqDist < 5) liqClass = 'danger';
        else if (liqDist < 15) liqClass = 'warning';
      }

      return `
        <tr>
          <td class="symbol-cell">${p.symbol}</td>
          <td><span class="side-badge ${p.side.toLowerCase()}">${p.side}</span></td>
          <td>${formatNumber(Math.abs(p.positionAmt))}</td>
          <td>${this.formatCurrency(p.entryPrice)}</td>
          <td>${this.formatCurrency(p.markPrice)}</td>
          <td>${p.liquidationPrice ? this.formatCurrency(p.liquidationPrice) : '—'}</td>
          <td class="${p.unRealizedProfit >= 0 ? 'positive' : 'negative'}">${this.formatCurrency(p.unRealizedProfit)}</td>
          <td class="roe-cell ${p.roe >= 0 ? 'positive' : 'negative'}">${p.roe >= 0 ? '+' : ''}${p.roe.toFixed(2)}%</td>
          <td>${p.leverage}x</td>
          <td class="${liqClass}">${liqDist !== null ? liqDist.toFixed(1) + '%' : '—'}</td>
        </tr>
      `;
    }).join('');
  }

  renderTrades(data) {
    const marketFilter = this.elements.tradeMarketFilter?.value || 'all';
    const symbolFilter = this.elements.tradeSymbolFilter?.value || 'all';
    
    let trades = data.trades || [];
    
    if (marketFilter !== 'all') trades = trades.filter(t => t.market === marketFilter);
    if (symbolFilter !== 'all') trades = trades.filter(t => t.symbol === symbolFilter);

    const tbody = document.querySelector('#trades-table tbody');

    tbody.innerHTML = trades.slice(0, 100).map(t => {
      const side = t.side || (t.isBuyer ? 'BUY' : 'SELL');
      const isBuy = side === 'BUY';
      const price = parseFloat(t.price);
      const qty = parseFloat(t.qty);
      const quote = parseFloat(t.quoteQty);
      const fee = parseFloat(t.commission || 0);
      const feeAsset = t.commissionAsset || '';

      return `
        <tr>
          <td>${formatTime(t.time)}</td>
          <td class="symbol-cell">${t.symbol}</td>
          <td><span class="side-badge ${t.market?.toLowerCase() || 'spot'}">${t.market || 'SPOT'}</span></td>
          <td><span class="side-badge ${isBuy ? 'buy' : 'sell'}">${side}</span></td>
          <td>${this.formatCurrency(price)}</td>
          <td>${formatNumber(qty)}</td>
          <td>${this.formatCurrency(quote)}</td>
          <td>${fee > 0 ? formatNumber(fee) + ' ' + feeAsset : '—'}</td>
          <td>${t.isMaker ? 'MAKER' : 'TAKER'}</td>
        </tr>
      `;
    }).join('') || '<tr><td colspan="9" style="text-align:center;color:var(--text-dim);padding:2rem;">No trades</td></tr>';
  }

  updateTradeSymbolFilter(data) {
    const select = this.elements.tradeSymbolFilter;
    if (!select) return;
    
    const symbols = [...new Set((data.trades || []).map(t => t.symbol))].sort();
    const currentValue = select.value;
    
    select.innerHTML = '<option value="all">ALL SYMBOLS</option>' + 
      symbols.map(s => `<option value="${s}">${s}</option>`).join('');
    
    if (symbols.includes(currentValue)) select.value = currentValue;
  }

  renderUnrealizedPnL(data) {
    const positions = data.unrealizedPnL?.positions || [];
    const tbody = document.querySelector('#unrealized-table tbody');
    const summary = document.getElementById('sum-unrealized');

    tbody.innerHTML = positions.map(p => {
      const liqDist = p.liquidationPrice && p.markPrice > 0 
        ? ((p.markPrice - p.liquidationPrice) / p.markPrice) * 100 * (p.side === 'LONG' ? 1 : -1)
        : null;
      let liqClass = 'safe';
      if (liqDist !== null) {
        if (liqDist < 5) liqClass = 'danger';
        else if (liqDist < 15) liqClass = 'warning';
      }

      return `
        <tr>
          <td class="symbol-cell">${p.symbol}</td>
          <td><span class="side-badge ${p.side.toLowerCase()}">${p.side}</span></td>
          <td>${formatNumber(p.size)}</td>
          <td>${this.formatCurrency(p.entryPrice)}</td>
          <td>${this.formatCurrency(p.markPrice)}</td>
          <td class="${p.unrealizedPnL >= 0 ? 'positive' : 'negative'}">${this.formatCurrency(p.unrealizedPnL)}</td>
          <td class="${p.roe >= 0 ? 'positive' : 'negative'}">${p.roe >= 0 ? '+' : ''}${p.roe.toFixed(2)}%</td>
          <td class="liq-distance ${liqClass}">${liqDist !== null ? liqDist.toFixed(1) + '%' : '—'}</td>
        </tr>
      `;
    }).join('') || '<tr><td colspan="8" style="text-align:center;color:var(--text-dim);padding:2rem;">No unrealized PnL</td></tr>';

    summary.textContent = this.formatCurrency(data.unrealizedPnL?.total || 0);
    summary.className = (data.unrealizedPnL?.total || 0) >= 0 ? 'positive' : 'negative';
  }

  renderRealizedPnL(data) {
    const bySymbol = data.realizedPnL?.bySymbol || {};
    const tbody = document.querySelector('#realized-table tbody');

    const symbols = Object.keys(bySymbol).sort((a, b) => 
      (bySymbol[b].realized + bySymbol[b].funding + bySymbol[b].commission) - 
      (bySymbol[a].realized + bySymbol[a].funding + bySymbol[a].commission)
    );

    tbody.innerHTML = symbols.map(symbol => {
      const d = bySymbol[symbol];
      const net = d.realized + d.funding + d.commission;
      return `
        <tr>
          <td class="symbol-cell">${symbol}</td>
          <td class="${d.realized >= 0 ? 'positive' : 'negative'}">${this.formatCurrency(d.realized)}</td>
          <td class="${d.funding >= 0 ? 'positive' : 'negative'}">${this.formatCurrency(d.funding)}</td>
          <td class="negative">${this.formatCurrency(d.commission)}</td>
          <td class="${net >= 0 ? 'positive' : 'negative'}">${this.formatCurrency(net)}</td>
          <td>${d.count}</td>
        </tr>
      `;
    }).join('') || '<tr><td colspan="6" style="text-align:center;color:var(--text-dim);padding:2rem;">No realized PnL</td></tr>';

    document.getElementById('sum-realized').textContent = this.formatCurrency(data.realizedPnL?.totalRealized || 0);
    document.getElementById('sum-realized').className = (data.realizedPnL?.totalRealized || 0) >= 0 ? 'positive' : 'negative';
    document.getElementById('sum-funding').textContent = this.formatCurrency(data.realizedPnL?.totalFunding || 0);
    document.getElementById('sum-funding').className = (data.realizedPnL?.totalFunding || 0) >= 0 ? 'positive' : 'negative';
    document.getElementById('sum-fees').textContent = this.formatCurrency(data.realizedPnL?.totalCommission || 0);
    document.getElementById('sum-net').textContent = this.formatCurrency(data.realizedPnL?.netPnL || 0);
    document.getElementById('sum-net').className = (data.realizedPnL?.netPnL || 0) >= 0 ? 'positive' : 'negative';
  }

  renderMarket(data) {
    const search = this.elements.marketSearch?.value?.toUpperCase() || '';
    const sort = this.elements.marketSort?.value || 'volume';
    
    let tickers = data.ticker24hr || [];
    
    if (search) {
      tickers = tickers.filter(t => t.symbol.includes(search));
    }

    tickers.sort((a, b) => {
      switch (sort) {
        case 'volume': return parseFloat(b.volume) - parseFloat(a.volume);
        case 'change': return parseFloat(b.priceChangePercent) - parseFloat(a.priceChangePercent);
        case 'price': return parseFloat(b.lastPrice) - parseFloat(a.lastPrice);
        default: return 0;
      }
    });

    const tbody = document.querySelector('#market-table tbody');

    tbody.innerHTML = tickers.slice(0, 100).map(t => {
      const change = parseFloat(t.priceChangePercent);
      const price = parseFloat(t.lastPrice);
      const high = parseFloat(t.highPrice);
      const low = parseFloat(t.lowPrice);
      const volume = parseFloat(t.volume);
      const quoteVolume = parseFloat(t.quoteVolume);

      return `
        <tr>
          <td class="symbol-cell">${t.symbol}</td>
          <td>${this.formatCurrency(price)}</td>
          <td class="${change >= 0 ? 'positive' : 'negative'}">${change >= 0 ? '+' : ''}${change.toFixed(2)}%</td>
          <td>${this.formatCurrency(high)}</td>
          <td>${this.formatCurrency(low)}</td>
          <td>${formatNumber(volume)}</td>
          <td>${this.formatCurrency(quoteVolume)}</td>
        </tr>
      `;
    }).join('') || '<tr><td colspan="7" style="text-align:center;color:var(--text-dim);padding:2rem;">No market data</td></tr>';
  }

  updatePrices(data) {
    // Prices are used in balance calculations, re-render balances
    this.renderBalances(data);
    this.renderOverview(data);
  }

  showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    
    const icons = {
      success: '<svg class="toast-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"></polyline></svg>',
      error: '<svg class="toast-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>',
      warning: '<svg class="toast-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>',
      info: '<svg class="toast-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>'
    };

    toast.innerHTML = `
      ${icons[type] || icons.info}
      <span class="toast-message">${message}</span>
      <button class="toast-close" aria-label="Close">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <line x1="18" y1="6" x2="6" y2="18"></line>
          <line x1="6" y1="6" x2="18" y2="18"></line>
        </svg>
      </button>
    `;

    toast.querySelector('.toast-close').addEventListener('click', () => toast.remove());
    
    this.toastContainer.appendChild(toast);
    
    setTimeout(() => {
      toast.style.animation = 'toast-in 0.3s ease reverse';
      setTimeout(() => toast.remove(), 300);
    }, 5000);
  }
}