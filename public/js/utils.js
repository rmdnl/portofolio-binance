export function formatNumber(num, decimals = 4) {
  if (num === null || num === undefined || isNaN(num)) return '—';
  const abs = Math.abs(num);
  if (abs >= 1e9) return (num / 1e9).toFixed(decimals) + 'B';
  if (abs >= 1e6) return (num / 1e6).toFixed(decimals) + 'M';
  if (abs >= 1e3) return (num / 1e3).toFixed(decimals) + 'K';
  if (abs >= 1) return num.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
  if (abs > 0) return num.toFixed(8).replace(/\.?0+$/, '');
  return '0';
}

export function formatCurrency(num, decimals = 2, currency = 'USD', usdToIdrRate = 15500) {
  if (num === null || num === undefined || isNaN(num)) return currency === 'IDR' ? 'Rp—' : '$—';
  const abs = Math.abs(num);
  const isIdr = currency === 'IDR';
  const value = isIdr ? num * usdToIdrRate : num;
  const prefix = isIdr ? 'Rp' : '$';
  
  if (isIdr) {
    if (abs * usdToIdrRate >= 1e12) return prefix + (value / 1e12).toFixed(decimals) + 'T';
    if (abs * usdToIdrRate >= 1e9) return prefix + (value / 1e9).toFixed(decimals) + 'M';
    if (abs * usdToIdrRate >= 1e6) return prefix + (value / 1e6).toFixed(decimals) + 'Jt';
    if (abs * usdToIdrRate >= 1e3) return prefix + (value / 1e3).toFixed(decimals) + 'Rb';
    return prefix + value.toLocaleString('id-ID', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  } else {
    if (abs >= 1e9) return prefix + (num / 1e9).toFixed(decimals) + 'B';
    if (abs >= 1e6) return prefix + (num / 1e6).toFixed(decimals) + 'M';
    if (abs >= 1e3) return prefix + (num / 1e3).toFixed(decimals) + 'K';
    return prefix + num.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
  }
}

export function formatPercent(num, decimals = 2) {
  if (num === null || num === undefined || isNaN(num)) return '—%';
  const sign = num >= 0 ? '+' : '';
  return `${sign}${num.toFixed(decimals)}%`;
}

export function formatTime(timestamp) {
  if (!timestamp) return '—';
  const date = new Date(timestamp);
  return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
}

export function timeAgo(timestamp) {
  if (!timestamp) return '—';
  const diff = Date.now() - timestamp;
  if (diff < 1000) return 'baru saja';
  if (diff < 60000) return `${Math.floor(diff / 1000)}dtk`;
  if (diff < 3600000) return `${Math.floor(diff / 60000)}mnt`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}jam`;
  return `${Math.floor(diff / 86400000)}hr`;
}

export function debounce(fn, delay) {
  let timeoutId;
  return (...args) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn(...args), delay);
  };
}

export function throttle(fn, limit) {
  let inThrottle;
  return (...args) => {
    if (!inThrottle) {
      fn(...args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  };
}

export function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

export function lerp(start, end, factor) {
  return start + (end - start) * factor;
}