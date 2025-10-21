const express = require('express');
const router = express.Router();
const webhookMonitor = require('../webhookMonitor');
const path = require('path');
const fs = require('fs');

/**
 * GET /api/webhook-monitor
 * Serve the webhook monitoring web interface
 */
router.get('/', (req, res) => {
  const htmlPath = path.join(__dirname, '../views/webhook-monitor.html');

  if (fs.existsSync(htmlPath)) {
    res.sendFile(htmlPath);
  } else {
    // Fallback inline HTML if file doesn't exist
    res.send(generateMonitorHTML());
  }
});

/**
 * GET /api/webhook-monitor/data
 * Get webhook data for the monitoring interface
 */
router.get('/data', (req, res) => {
  const limit = parseInt(req.query.limit) || 50;
  const webhooks = webhookMonitor.getRecentWebhooks(limit);
  const stats = webhookMonitor.getStats();

  res.json({
    webhooks,
    stats
  });
});

/**
 * POST /api/webhook-monitor/clear
 * Clear all webhook history
 */
router.post('/clear', (req, res) => {
  webhookMonitor.clear();
  res.json({ success: true, message: 'Webhook history cleared' });
});

/**
 * Generate inline HTML for monitoring interface
 */
function generateMonitorHTML() {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Wise Webhook Monitor - Live</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }

    body {
      font-family: 'SF Mono', 'Monaco', 'Courier New', monospace;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      min-height: 100vh;
      padding: 20px;
    }

    .container {
      max-width: 1400px;
      margin: 0 auto;
    }

    .header {
      background: white;
      padding: 30px;
      border-radius: 15px;
      margin-bottom: 20px;
      box-shadow: 0 10px 30px rgba(0,0,0,0.2);
    }

    h1 {
      color: #667eea;
      font-size: 32px;
      margin-bottom: 10px;
    }

    .subtitle {
      color: #666;
      font-size: 14px;
    }

    .stats {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 15px;
      margin-bottom: 20px;
    }

    .stat-card {
      background: white;
      padding: 20px;
      border-radius: 10px;
      box-shadow: 0 5px 15px rgba(0,0,0,0.1);
      border-left: 5px solid #667eea;
    }

    .stat-value {
      font-size: 36px;
      font-weight: bold;
      color: #667eea;
      margin-bottom: 5px;
    }

    .stat-label {
      color: #888;
      font-size: 14px;
      text-transform: uppercase;
      letter-spacing: 1px;
    }

    .controls {
      background: white;
      padding: 20px;
      border-radius: 10px;
      margin-bottom: 20px;
      box-shadow: 0 5px 15px rgba(0,0,0,0.1);
      display: flex;
      gap: 10px;
      flex-wrap: wrap;
      align-items: center;
    }

    button {
      background: #667eea;
      color: white;
      border: none;
      padding: 12px 24px;
      border-radius: 8px;
      cursor: pointer;
      font-size: 14px;
      font-weight: 600;
      transition: all 0.3s;
    }

    button:hover {
      background: #764ba2;
      transform: translateY(-2px);
      box-shadow: 0 5px 15px rgba(102,126,234,0.4);
    }

    button.active {
      background: #10b981;
    }

    button.danger {
      background: #ef4444;
    }

    button.danger:hover {
      background: #dc2626;
    }

    .status-indicator {
      display: inline-block;
      width: 12px;
      height: 12px;
      border-radius: 50%;
      background: #10b981;
      animation: pulse 2s infinite;
      margin-right: 8px;
    }

    @keyframes pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.5; }
    }

    .webhooks-container {
      background: white;
      border-radius: 10px;
      padding: 20px;
      box-shadow: 0 10px 30px rgba(0,0,0,0.2);
      max-height: calc(100vh - 450px);
      overflow-y: auto;
    }

    .webhook-item {
      border: 2px solid #e5e7eb;
      border-radius: 8px;
      padding: 20px;
      margin-bottom: 15px;
      transition: all 0.3s;
    }

    .webhook-item:hover {
      border-color: #667eea;
      box-shadow: 0 5px 15px rgba(102,126,234,0.2);
    }

    .webhook-item.test {
      background: #fef3c7;
      border-color: #fbbf24;
    }

    .webhook-item.production {
      background: #dbeafe;
      border-color: #3b82f6;
    }

    .webhook-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 15px;
      padding-bottom: 10px;
      border-bottom: 1px solid #e5e7eb;
    }

    .webhook-time {
      font-size: 14px;
      color: #667eea;
      font-weight: bold;
    }

    .webhook-badge {
      padding: 4px 12px;
      border-radius: 20px;
      font-size: 12px;
      font-weight: bold;
    }

    .badge-test {
      background: #fbbf24;
      color: #78350f;
    }

    .badge-production {
      background: #3b82f6;
      color: white;
    }

    .webhook-meta {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
      gap: 10px;
      margin-bottom: 15px;
      font-size: 13px;
    }

    .meta-item {
      color: #666;
    }

    .meta-label {
      font-weight: bold;
      color: #333;
    }

    .webhook-payload {
      background: #1e293b;
      color: #e2e8f0;
      padding: 15px;
      border-radius: 8px;
      overflow-x: auto;
      font-size: 12px;
      line-height: 1.6;
    }

    .empty-state {
      text-align: center;
      padding: 60px 20px;
      color: #888;
    }

    .empty-state-icon {
      font-size: 64px;
      margin-bottom: 20px;
    }

    ::-webkit-scrollbar {
      width: 10px;
    }

    ::-webkit-scrollbar-track {
      background: #f1f1f1;
      border-radius: 10px;
    }

    ::-webkit-scrollbar-thumb {
      background: #667eea;
      border-radius: 10px;
    }

    ::-webkit-scrollbar-thumb:hover {
      background: #764ba2;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🔔 Wise Webhook Monitor</h1>
      <p class="subtitle">
        <span class="status-indicator"></span>
        Live monitoring - Updates every 3 seconds
      </p>
    </div>

    <div class="stats">
      <div class="stat-card">
        <div class="stat-value" id="total-webhooks">0</div>
        <div class="stat-label">Total Webhooks</div>
      </div>
      <div class="stat-card">
        <div class="stat-value" id="success-webhooks">0</div>
        <div class="stat-label">Successful</div>
      </div>
      <div class="stat-card">
        <div class="stat-value" id="error-webhooks">0</div>
        <div class="stat-label">Errors</div>
      </div>
      <div class="stat-card">
        <div class="stat-value" id="in-memory">0</div>
        <div class="stat-label">In Memory</div>
      </div>
    </div>

    <div class="controls">
      <button class="active" id="auto-refresh-btn" onclick="toggleAutoRefresh()">
        Auto-Refresh: ON
      </button>
      <button onclick="refreshNow()">
        Refresh Now
      </button>
      <button class="danger" onclick="clearHistory()">
        Clear History
      </button>
      <span style="margin-left: auto; color: white; font-size: 14px;">
        Last updated: <span id="last-update">Never</span>
      </span>
    </div>

    <div class="webhooks-container" id="webhooks-container">
      <div class="empty-state">
        <div class="empty-state-icon">📭</div>
        <p>No webhooks received yet</p>
        <p style="margin-top: 10px; font-size: 14px;">Send a test webhook to see it appear here</p>
      </div>
    </div>
  </div>

  <script>
    let autoRefresh = true;
    let refreshInterval = null;

    function toggleAutoRefresh() {
      autoRefresh = !autoRefresh;
      const btn = document.getElementById('auto-refresh-btn');
      btn.textContent = 'Auto-Refresh: ' + (autoRefresh ? 'ON' : 'OFF');
      btn.classList.toggle('active', autoRefresh);

      if (autoRefresh) {
        startAutoRefresh();
      } else {
        stopAutoRefresh();
      }
    }

    function startAutoRefresh() {
      refreshInterval = setInterval(fetchWebhooks, 3000);
    }

    function stopAutoRefresh() {
      if (refreshInterval) {
        clearInterval(refreshInterval);
      }
    }

    function refreshNow() {
      fetchWebhooks();
    }

    async function clearHistory() {
      if (!confirm('Clear all webhook history?')) return;

      try {
        await fetch('/api/webhook-monitor/clear', { method: 'POST' });
        await fetchWebhooks();
      } catch (error) {
        console.error('Failed to clear history:', error);
      }
    }

    async function fetchWebhooks() {
      try {
        const response = await fetch('/api/webhook-monitor/data');
        const data = await response.json();

        updateStats(data.stats);
        renderWebhooks(data.webhooks);

        document.getElementById('last-update').textContent = new Date().toLocaleTimeString();
      } catch (error) {
        console.error('Failed to fetch webhooks:', error);
      }
    }

    function updateStats(stats) {
      document.getElementById('total-webhooks').textContent = stats.total;
      document.getElementById('success-webhooks').textContent = stats.success;
      document.getElementById('error-webhooks').textContent = stats.errors;
      document.getElementById('in-memory').textContent = stats.inMemory;
    }

    function renderWebhooks(webhooks) {
      const container = document.getElementById('webhooks-container');

      if (webhooks.length === 0) {
        container.innerHTML = \`
          <div class="empty-state">
            <div class="empty-state-icon">📭</div>
            <p>No webhooks received yet</p>
            <p style="margin-top: 10px; font-size: 14px;">Send a test webhook to see it appear here</p>
          </div>
        \`;
        return;
      }

      container.innerHTML = webhooks.map(webhook => \`
        <div class="webhook-item \${webhook.isTest ? 'test' : 'production'}">
          <div class="webhook-header">
            <div class="webhook-time">\${formatTime(webhook.timestamp)}</div>
            <div class="webhook-badge \${webhook.isTest ? 'badge-test' : 'badge-production'}">
              \${webhook.isTest ? 'TEST' : 'PRODUCTION'}
            </div>
          </div>

          <div class="webhook-meta">
            <div class="meta-item">
              <span class="meta-label">IP:</span> \${webhook.ip}
            </div>
            <div class="meta-item">
              <span class="meta-label">Method:</span> \${webhook.method}
            </div>
            <div class="meta-item">
              <span class="meta-label">Event:</span> \${webhook.payload?.event_type || 'N/A'}
            </div>
          </div>

          <details>
            <summary style="cursor: pointer; padding: 10px; background: #f3f4f6; border-radius: 5px; margin-bottom: 10px;">
              <strong>View Full Payload</strong>
            </summary>
            <div class="webhook-payload">
              <pre>\${JSON.stringify(webhook.payload, null, 2)}</pre>
            </div>
          </details>
        </div>
      \`).join('');
    }

    function formatTime(timestamp) {
      const date = new Date(timestamp);
      return date.toLocaleString();
    }

    // Start auto-refresh
    fetchWebhooks();
    startAutoRefresh();
  </script>
</body>
</html>`;
}

module.exports = router;
