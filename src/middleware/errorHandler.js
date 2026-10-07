export function errorHandler(err, req, res, next) {
  const isDev = process.env.NODE_ENV !== 'production';
  
  console.error(`[ERROR] ${req.method} ${req.path}:`, err.message);
  if (isDev) console.error(err.stack);

  if (err.code === 'ECONNREFUSED' || err.code === 'ENOTFOUND') {
    return res.status(503).json({
      success: false,
      error: 'Service unavailable - unable to reach Binance API',
      timestamp: Date.now()
    });
  }

  if (err.response) {
    const status = err.response.status;
    const data = err.response.data;
    
    if (status === 401 || status === 403) {
      return res.status(401).json({
        success: false,
        error: 'Invalid API credentials - check your read-only API keys',
        timestamp: Date.now()
      });
    }
    
    if (status === 429) {
      return res.status(429).json({
        success: false,
        error: 'Rate limited by Binance - please wait',
        retryAfter: err.response.headers?.['retry-after'] || 60,
        timestamp: Date.now()
      });
    }

    return res.status(status).json({
      success: false,
      error: data?.msg || `Binance API error: ${status}`,
      code: data?.code,
      timestamp: Date.now()
    });
  }

  res.status(500).json({
    success: false,
    error: isDev ? err.message : 'Internal server error',
    timestamp: Date.now()
  });
}