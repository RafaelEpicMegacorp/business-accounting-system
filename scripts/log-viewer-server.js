#!/usr/bin/env node

/**
 * Railway Log Viewer - Web Interface
 *
 * A simple web server that displays Railway logs in your browser
 *
 * Usage:
 *   node scripts/log-viewer-server.js
 *   Then open: http://localhost:4001
 */

const http = require('http');
const { spawn } = require('child_process');

const PORT = process.env.LOG_VIEWER_PORT || 4001;
let logBuffer = [];
const MAX_LOGS = 500; // Keep last 500 log lines

// HTML interface
const HTML_PAGE = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Railway Logs - Real-Time Viewer</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    body {
      font-family: 'Monaco', 'Courier New', monospace;
      background: #1e1e1e;
      color: #d4d4d4;
      padding: 20px;
    }

    .header {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      padding: 20px;
      border-radius: 10px;
      margin-bottom: 20px;
      box-shadow: 0 4px 6px rgba(0,0,0,0.3);
    }

    h1 {
      color: white;
      font-size: 24px;
      margin-bottom: 10px;
    }

    .status {
      color: #a8dadc;
      font-size: 14px;
    }

    .controls {
      display: flex;
      gap: 10px;
      margin-bottom: 20px;
      flex-wrap: wrap;
    }

    button {
      background: #667eea;
      color: white;
      border: none;
      padding: 10px 20px;
      border-radius: 5px;
      cursor: pointer;
      font-size: 14px;
      transition: all 0.3s;
    }

    button:hover {
      background: #764ba2;
      transform: translateY(-2px);
    }

    button.active {
      background: #48bb78;
    }

    .filter-input {
      padding: 10px;
      border: 2px solid #667eea;
      border-radius: 5px;
      background: #2d2d2d;
      color: #d4d4d4;
      font-size: 14px;
      flex: 1;
      min-width: 200px;
    }

    .log-container {
      background: #252526;
      border-radius: 10px;
      padding: 20px;
      height: calc(100vh - 280px);
      overflow-y: auto;
      box-shadow: 0 4px 6px rgba(0,0,0,0.3);
      border: 1px solid #3e3e42;
    }

    .log-line {
      padding: 8px 12px;
      border-bottom: 1px solid #3e3e42;
      font-size: 13px;
      line-height: 1.6;
      word-wrap: break-word;
    }

    .log-line:hover {
      background: #2d2d2d;
    }

    .log-line.webhook {
      background: #1e3a5f;
      border-left: 4px solid #3b82f6;
    }

    .log-line.error {
      background: #3d1f1f;
      border-left: 4px solid #ef4444;
    }

    .log-line.success {
      background: #1f3d2f;
      border-left: 4px solid #10b981;
    }

    .timestamp {
      color: #888;
      margin-right: 10px;
    }

    .stats {
      display: flex;
      gap: 20px;
      margin-bottom: 20px;
      flex-wrap: wrap;
    }

    .stat-card {
      background: #2d2d2d;
      padding: 15px 20px;
      border-radius: 8px;
      border-left: 4px solid #667eea;
    }

    .stat-value {
      font-size: 24px;
      font-weight: bold;
      color: #667eea;
    }

    .stat-label {
      font-size: 12px;
      color: #888;
      margin-top: 5px;
    }

    .empty-state {
      text-align: center;
      padding: 60px 20px;
      color: #888;
    }

    .loading {
      display: inline-block;
      width: 20px;
      height: 20px;
      border: 3px solid #667eea;
      border-top-color: transparent;
      border-radius: 50%;
      animation: spin 1s linear infinite;
    }

    @keyframes spin {
      to { transform: rotate(360deg); }
    }

    ::-webkit-scrollbar {
      width: 10px;
    }

    ::-webkit-scrollbar-track {
      background: #1e1e1e;
    }

    ::-webkit-scrollbar-thumb {
      background: #667eea;
      border-radius: 5px;
    }

    ::-webkit-scrollbar-thumb:hover {
      background: #764ba2;
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>🚂 Railway Logs - Real-Time Viewer</h1>
    <div class="status">
      Service: <strong>business-accounting-system</strong> |
      Status: <span id="status"><span class="loading"></span> Connecting...</span>
    </div>
  </div>

  <div class="stats">
    <div class="stat-card">
      <div class="stat-value" id="total-logs">0</div>
      <div class="stat-label">Total Logs</div>
    </div>
    <div class="stat-card">
      <div class="stat-value" id="webhook-logs">0</div>
      <div class="stat-label">Webhook Events</div>
    </div>
    <div class="stat-card">
      <div class="stat-value" id="error-logs">0</div>
      <div class="stat-label">Errors</div>
    </div>
  </div>

  <div class="controls">
    <button id="filter-all" class="active" onclick="setFilter('all')">All Logs</button>
    <button id="filter-webhook" onclick="setFilter('webhook')">Webhooks Only</button>
    <button id="filter-error" onclick="setFilter('error')">Errors Only</button>
    <input type="text" class="filter-input" id="search" placeholder="🔍 Search logs..." oninput="filterLogs()">
    <button onclick="clearLogs()">Clear</button>
    <button id="auto-scroll-btn" class="active" onclick="toggleAutoScroll()">Auto-Scroll: ON</button>
  </div>

  <div class="log-container" id="log-container">
    <div class="empty-state">
      <div class="loading"></div>
      <p style="margin-top: 20px;">Waiting for logs...</p>
    </div>
  </div>

  <script>
    let logs = [];
    let currentFilter = 'all';
    let autoScroll = true;

    function setFilter(filter) {
      currentFilter = filter;
      document.querySelectorAll('.controls button').forEach(btn => {
        btn.classList.remove('active');
      });
      document.getElementById('filter-' + filter).classList.add('active');
      filterLogs();
    }

    function toggleAutoScroll() {
      autoScroll = !autoScroll;
      const btn = document.getElementById('auto-scroll-btn');
      btn.textContent = 'Auto-Scroll: ' + (autoScroll ? 'ON' : 'OFF');
      btn.classList.toggle('active', autoScroll);
    }

    function clearLogs() {
      logs = [];
      renderLogs();
      updateStats();
    }

    function classifyLog(text) {
      const lower = text.toLowerCase();
      if (lower.includes('webhook') || lower.includes('wise') || lower.includes('🔔')) {
        return 'webhook';
      }
      if (lower.includes('error') || lower.includes('❌') || lower.includes('failed')) {
        return 'error';
      }
      if (lower.includes('✅') || lower.includes('success')) {
        return 'success';
      }
      return 'normal';
    }

    function filterLogs() {
      const search = document.getElementById('search').value.toLowerCase();
      const container = document.getElementById('log-container');

      const filtered = logs.filter(log => {
        if (currentFilter !== 'all' && log.type !== currentFilter) {
          return false;
        }
        if (search && !log.text.toLowerCase().includes(search)) {
          return false;
        }
        return true;
      });

      if (filtered.length === 0) {
        container.innerHTML = '<div class="empty-state"><p>No logs match your filter</p></div>';
        return;
      }

      container.innerHTML = filtered.map(log =>
        \`<div class="log-line \${log.type}">
          <span class="timestamp">\${log.timestamp}</span>
          <span>\${escapeHtml(log.text)}</span>
        </div>\`
      ).join('');

      if (autoScroll) {
        container.scrollTop = container.scrollHeight;
      }
    }

    function escapeHtml(text) {
      const div = document.createElement('div');
      div.textContent = text;
      return div.innerHTML;
    }

    function renderLogs() {
      filterLogs();
    }

    function updateStats() {
      document.getElementById('total-logs').textContent = logs.length;
      document.getElementById('webhook-logs').textContent = logs.filter(l => l.type === 'webhook').length;
      document.getElementById('error-logs').textContent = logs.filter(l => l.type === 'error').length;
    }

    function addLog(text) {
      const timestamp = new Date().toLocaleTimeString();
      const type = classifyLog(text);

      logs.push({ text, timestamp, type });

      // Keep only last 500 logs
      if (logs.length > 500) {
        logs.shift();
      }

      renderLogs();
      updateStats();
    }

    // Poll for new logs
    async function fetchLogs() {
      try {
        const response = await fetch('/logs');
        const data = await response.json();

        document.getElementById('status').innerHTML = '✅ Connected';

        if (data.logs && data.logs.length > 0) {
          data.logs.forEach(log => addLog(log));
        }
      } catch (error) {
        document.getElementById('status').innerHTML = '❌ Connection Error';
        console.error('Failed to fetch logs:', error);
      }
    }

    // Fetch logs every 2 seconds
    setInterval(fetchLogs, 2000);
    fetchLogs(); // Initial fetch
  </script>
</body>
</html>
`;

// Check if Railway CLI is available
function checkRailwayCLI() {
  return new Promise((resolve) => {
    const check = spawn('railway', ['--version']);
    check.on('error', () => resolve(false));
    check.on('close', (code) => resolve(code === 0));
  });
}

// Start Railway logs process
let railwayProcess = null;
let isAuthenticated = false;

async function startRailwayLogs() {
  const hasRailway = await checkRailwayCLI();

  if (!hasRailway) {
    console.error('❌ Railway CLI not found!');
    console.error('\n📦 Install with:');
    console.error('   npm install -g @railway/cli');
    console.error('   OR');
    console.error('   brew install railway\n');
    return false;
  }

  railwayProcess = spawn('railway', ['logs', '--service', 'business-accounting-system']);

  let buffer = '';

  railwayProcess.stdout.on('data', (data) => {
    buffer += data.toString();
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    lines.forEach(line => {
      if (!line.trim()) return;

      // Remove Railway timestamp prefix
      const cleanLine = line.replace(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d+Z\s+/, '');

      logBuffer.push(cleanLine);
      if (logBuffer.length > MAX_LOGS) {
        logBuffer.shift();
      }
    });
  });

  railwayProcess.stderr.on('data', (data) => {
    const message = data.toString();
    if (message.toLowerCase().includes('unauthorized')) {
      isAuthenticated = false;
      logBuffer.push('❌ Not logged in to Railway. Run: railway login');
    }
  });

  railwayProcess.on('error', (err) => {
    console.error('❌ Failed to start Railway logs:', err.message);
    return false;
  });

  isAuthenticated = true;
  return true;
}

// HTTP Server
const server = http.createServer((req, res) => {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  if (req.url === '/') {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(HTML_PAGE);
  } else if (req.url === '/logs') {
    res.writeHead(200, { 'Content-Type': 'application/json' });

    // Send new logs since last check
    const newLogs = [...logBuffer];
    logBuffer = []; // Clear buffer after sending

    res.end(JSON.stringify({
      logs: newLogs,
      authenticated: isAuthenticated
    }));
  } else {
    res.writeHead(404);
    res.end('Not Found');
  }
});

// Start server
async function start() {
  console.log('╔' + '═'.repeat(63) + '╗');
  console.log('║' + ' '.repeat(15) + 'Railway Log Viewer - Web UI' + ' '.repeat(20) + '║');
  console.log('╚' + '═'.repeat(63) + '╝\n');

  const started = await startRailwayLogs();

  if (!started) {
    process.exit(1);
  }

  server.listen(PORT, () => {
    console.log('✅ Server started successfully!\n');
    console.log('🌐 Open in browser:');
    console.log(`   http://localhost:${PORT}\n`);
    console.log('📋 Features:');
    console.log('   • Real-time log streaming');
    console.log('   • Filter by webhook, error, or all');
    console.log('   • Search functionality');
    console.log('   • Auto-scroll toggle');
    console.log('   • Statistics dashboard\n');
    console.log('⏹️  Press Ctrl+C to stop\n');
  });
}

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n\n⏹️  Shutting down...');
  if (railwayProcess) {
    railwayProcess.kill();
  }
  server.close();
  console.log('✅ Goodbye!\n');
  process.exit(0);
});

// Start the server
start();
