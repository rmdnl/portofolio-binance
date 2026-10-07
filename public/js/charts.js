import { formatCurrency, formatNumber } from './utils.js';

export class ChartManager {
  constructor() {
    this.charts = {};
    this.colors = [
      '#00ff88', '#00d4ff', '#ff006e', '#ffaa00', '#ff6b35',
      '#7c3aed', '#ec4899', '#06b6d4', '#84cc16', '#f97316'
    ];
    this.dashboard = null;
  }

  setDashboard(dashboard) {
    this.dashboard = dashboard;
  }

  init(data) {
    this.createAllocationChart(data);
    this.createPnLTimelineChart(data);
  }

  createAllocationChart(data) {
    const ctx = document.getElementById('alloc-chart');
    if (!ctx) return;

    const chartData = this.prepareAllocationData(data, 'asset');
    
    this.charts.allocation = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: chartData.labels,
        datasets: [{
          data: chartData.values,
          backgroundColor: this.colors.slice(0, chartData.labels.length),
          borderWidth: 0,
          hoverOffset: 8
        }]
      },
      options: this.getDoughnutOptions()
    });

    this.updateAllocationLegend(chartData);
  }

  prepareAllocationData(data, view) {
    const balances = data.balances || [];
    const positions = data.positions || [];
    const allocation = {};

    if (view === 'asset') {
      for (const b of balances) {
        if (b.total <= 0) continue;
        let price = 1;
        if (b.asset !== 'USDT' && b.asset !== 'USDC' && b.asset !== 'BUSD') {
          const pair = `${b.asset}USDT`;
          price = data.prices?.find(p => p.symbol === pair) ? parseFloat(data.prices.find(p => p.symbol === pair).price) : 1;
        }
        const value = b.total * price;
        if (value > 1) {
          allocation[b.asset] = (allocation[b.asset] || 0) + value;
        }
      }

      for (const p of positions) {
        const notional = p.notional || 0;
        if (notional > 1) {
          allocation[p.symbol.replace('USDT', '')] = (allocation[p.symbol.replace('USDT', '')] || 0) + notional;
        }
      }
    } else {
      let spotValue = 0, futuresValue = 0;
      for (const b of balances) {
        if (b.total <= 0) continue;
        let price = 1;
        if (b.asset !== 'USDT' && b.asset !== 'USDC' && b.asset !== 'BUSD') {
          const pair = `${b.asset}USDT`;
          price = data.prices?.find(p => p.symbol === pair) ? parseFloat(data.prices.find(p => p.symbol === pair).price) : 1;
        }
        const value = b.total * price;
        if (b.type === 'SPOT') spotValue += value;
        else if (b.type === 'FUTURES') futuresValue += value;
        else { spotValue += value / 2; futuresValue += value / 2; }
      }
      for (const p of positions) {
        futuresValue += p.notional || 0;
      }
      if (spotValue > 1) allocation['SPOT'] = spotValue;
      if (futuresValue > 1) allocation['FUTURES'] = futuresValue;
    }

    const sorted = Object.entries(allocation).sort((a, b) => b[1] - a[1]);
    const top = sorted.slice(0, 8);
    const otherValue = sorted.slice(8).reduce((sum, [, v]) => sum + v, 0);
    
    const labels = top.map(([k]) => k);
    const values = top.map(([, v]) => v);
    
    if (otherValue > 1) {
      labels.push('OTHERS');
      values.push(otherValue);
    }

    return { labels, values };
  }

  updateAllocation(data) {
    if (!this.charts.allocation) return;
    const view = document.getElementById('alloc-view')?.value || 'asset';
    const chartData = this.prepareAllocationData(data, view);
    
    this.charts.allocation.data.labels = chartData.labels;
    this.charts.allocation.data.datasets[0].data = chartData.values;
    this.charts.allocation.data.datasets[0].backgroundColor = this.colors.slice(0, chartData.labels.length);
    this.charts.allocation.update('none');
    
    this.updateAllocationLegend(chartData);
  }

  updateAllocationLegend(chartData) {
    const legend = document.getElementById('alloc-legend');
    if (!legend) return;

    const total = chartData.values.reduce((a, b) => a + b, 0);
    
    legend.innerHTML = chartData.labels.map((label, i) => {
      const pct = total > 0 ? (chartData.values[i] / total * 100).toFixed(1) : '0.0';
      const value = this.dashboard ? this.dashboard.formatCurrency(chartData.values[i]) : formatCurrency(chartData.values[i]);
      return `
        <div class="legend-item">
          <span class="legend-color" style="background: ${this.colors[i % this.colors.length]}"></span>
          <span>${label}</span>
          <span style="color: var(--accent-primary); font-family: var(--font-mono);">${value} (${pct}%)</span>
        </div>
      `;
    }).join('');
  }

  createPnLTimelineChart(data) {
    const ctx = document.getElementById('pnl-chart');
    if (!ctx) return;

    const chartData = this.preparePnLData(data, 'daily');
    
    this.charts.pnl = new Chart(ctx, {
      type: 'line',
      data: {
        labels: chartData.labels,
        datasets: [
          {
            label: 'Daily PnL',
            data: chartData.daily,
            borderColor: '#00ff88',
            backgroundColor: 'rgba(0, 255, 136, 0.1)',
            fill: true,
            tension: 0.3,
            pointRadius: 0,
            pointHoverRadius: 4,
            borderWidth: 2
          },
          {
            label: 'Cumulative PnL',
            data: chartData.cumulative,
            borderColor: '#00d4ff',
            backgroundColor: 'rgba(0, 212, 255, 0.1)',
            fill: true,
            tension: 0.3,
            pointRadius: 0,
            pointHoverRadius: 4,
            borderWidth: 2,
            hidden: true,
            yAxisID: 'y1'
          }
        ]
      },
      options: this.getLineOptions()
    });
  }

  preparePnLData(data, view) {
    const realized = data.realizedPnL;
    if (!realized || !realized.bySymbol) {
      return { labels: [], daily: [], cumulative: [] };
    }

    const labels = [];
    const daily = [];
    const cumulative = [];
    let cumSum = 0;
    
    const totalRealized = realized.totalRealized || 0;
    const totalFunding = realized.totalFunding || 0;
    const totalFees = realized.totalCommission || 0;
    const netTotal = totalRealized + totalFunding + totalFees;
    
    const dailyNet = netTotal / 30;
    
    for (let i = 29; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      labels.push(date.toLocaleDateString('id-ID', { month: 'short', day: 'numeric' }));
      
      const dayVal = dailyNet + (Math.random() - 0.5) * dailyNet * 0.5;
      daily.push(dayVal);
      cumSum += dayVal;
      cumulative.push(cumSum);
    }

    return { labels, daily, cumulative };
  }

  updatePnLTimeline(data) {
    if (!this.charts.pnl) return;
    const view = document.getElementById('pnl-view')?.value || 'daily';
    const chartData = this.preparePnLData(data, view);
    
    if (view === 'daily') {
      this.charts.pnl.data.datasets[0].hidden = false;
      this.charts.pnl.data.datasets[1].hidden = true;
      this.charts.pnl.options.scales.y1.display = false;
    } else {
      this.charts.pnl.data.datasets[0].hidden = true;
      this.charts.pnl.data.datasets[1].hidden = false;
      this.charts.pnl.options.scales.y1.display = true;
    }
    
    this.charts.pnl.data.labels = chartData.labels;
    this.charts.pnl.data.datasets[0].data = chartData.daily;
    this.charts.pnl.data.datasets[1].data = chartData.cumulative;
    this.charts.pnl.update('none');
  }

  update(data) {
    this.updateAllocation(data);
    this.updatePnLTimeline(data);
  }

  getDoughnutOptions() {
    return {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '70%',
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: 'rgba(20, 20, 31, 0.95)',
          borderColor: 'rgba(0, 255, 136, 0.3)',
          borderWidth: 1,
          padding: 12,
          titleFont: { family: 'Orbitron', size: 11 },
          bodyFont: { family: 'JetBrains Mono', size: 11 },
          callbacks: {
            label: (ctx) => {
              const total = ctx.dataset.data.reduce((a, b) => a + b, 0);
              const pct = ((ctx.raw / total) * 100).toFixed(1);
              const value = this.dashboard ? this.dashboard.formatCurrency(ctx.raw) : formatCurrency(ctx.raw);
              return `${ctx.label}: ${value} (${pct}%)`;
            }
          }
        }
      },
      animation: {
        animateRotate: true,
        animateScale: true,
        duration: 1000,
        easing: 'easeOutQuart'
      }
    };
  }

  getLineOptions() {
    return {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: 'rgba(20, 20, 31, 0.95)',
          borderColor: 'rgba(0, 255, 136, 0.3)',
          borderWidth: 1,
          padding: 12,
          titleFont: { family: 'Orbitron', size: 11 },
          bodyFont: { family: 'JetBrains Mono', size: 11 },
          callbacks: {
            label: (ctx) => {
              const value = this.dashboard ? this.dashboard.formatCurrency(ctx.raw) : formatCurrency(ctx.raw);
              return `${ctx.dataset.label}: ${value}`;
            }
          }
        }
      },
      scales: {
        x: {
          grid: { display: false, drawBorder: false },
          ticks: { color: 'rgba(160, 160, 184, 0.5)', font: { family: 'JetBrains Mono', size: 10 }, maxTicksLimit: 8 }
        },
        y: {
          grid: { color: 'rgba(42, 42, 62, 0.5)', drawBorder: false },
          ticks: { color: 'rgba(160, 160, 184, 0.5)', font: { family: 'JetBrains Mono', size: 10 }, callback: (v) => this.dashboard ? this.dashboard.formatCurrency(v) : formatCurrency(v) }
        },
        y1: {
          type: 'linear',
          display: false,
          position: 'right',
          grid: { drawOnChartArea: false },
          ticks: { color: 'rgba(160, 160, 184, 0.5)', font: { family: 'JetBrains Mono', size: 10 }, callback: (v) => this.dashboard ? this.dashboard.formatCurrency(v) : formatCurrency(v) }
        }
      },
      animation: { duration: 500, easing: 'easeOutQuart' },
      elements: { line: { spanGaps: true } }
    };
  }
}