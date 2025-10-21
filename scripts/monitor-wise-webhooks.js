#!/usr/bin/env node

/**
 * Wise Webhook Monitor
 *
 * Monitors Railway deployment logs in real-time and displays
 * Wise webhook calls with full details.
 *
 * Usage:
 *   node scripts/monitor-wise-webhooks.js
 *
 * Requirements:
 *   - Railway CLI installed (https://docs.railway.app/develop/cli)
 *   - Logged in to Railway (railway login)
 *
 * Alternative (if Railway CLI not available):
 *   - View logs in Railway dashboard: https://railway.app/
 *   - Look for "WISE WEBHOOK RECEIVED" in logs
 */

const { spawn } = require('child_process');

console.log('╔' + '═'.repeat(78) + '╗');
console.log('║' + ' '.repeat(22) + 'WISE WEBHOOK MONITOR' + ' '.repeat(34) + '║');
console.log('╚' + '═'.repeat(78) + '╝\n');

console.log('🔍 Monitoring Railway logs for Wise webhook calls...');
console.log('📋 Showing webhook data in real-time\n');
console.log('💡 Trigger a test webhook from Wise dashboard to see it appear here\n');
console.log('⏹️  Press Ctrl+C to stop monitoring\n');
console.log('─'.repeat(80) + '\n');

// Check if Railway CLI is available
const railwayCheck = spawn('railway', ['--version']);

railwayCheck.on('error', (err) => {
  console.error('❌ Railway CLI not found!');
  console.error('\n📦 Please install Railway CLI:');
  console.error('   npm install -g @railway/cli');
  console.error('   OR');
  console.error('   brew install railway');
  console.error('\n🔑 Then login:');
  console.error('   railway login');
  console.error('\n📖 Documentation: https://docs.railway.app/develop/cli\n');
  console.error('🌐 Alternative: View logs in Railway dashboard at https://railway.app/\n');
  process.exit(1);
});

railwayCheck.on('close', (code) => {
  if (code === 0) {
    // Railway CLI is available, start monitoring
    startMonitoring();
  }
});

function startMonitoring() {
  // Start Railway logs with follow mode
  const railway = spawn('railway', ['logs', '--service', 'business-accounting-system']);

  let buffer = '';
  let inWebhookBlock = false;
  let webhookLines = [];

  railway.stdout.on('data', (data) => {
    buffer += data.toString();
    const lines = buffer.split('\n');

    // Keep the last incomplete line in buffer
    buffer = lines.pop() || '';

    for (const line of lines) {
      // Detect start of webhook block
      if (line.includes('WISE WEBHOOK RECEIVED') || line.includes('╔═══')) {
        inWebhookBlock = true;
        webhookLines = [];
        console.log('\n' + '🔔'.repeat(40));
        console.log('📨 NEW WEBHOOK RECEIVED!');
        console.log('🔔'.repeat(40) + '\n');
      }

      // Collect lines in webhook block
      if (inWebhookBlock) {
        webhookLines.push(line);
      }

      // Detect end of webhook block
      if (line.includes('────────') || line.includes('Responding with 200 OK')) {
        inWebhookBlock = false;

        // Display webhook block
        webhookLines.forEach(l => {
          // Remove timestamp prefix if present (Railway adds it)
          const cleanLine = l.replace(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d+Z\s+/, '');
          console.log(cleanLine);
        });

        console.log('\n' + '─'.repeat(80));
        console.log('⏰ Waiting for next webhook...\n');
      }

      // Also show errors
      if (line.includes('❌') || line.includes('ERROR') || line.includes('Error')) {
        console.log('🚨 ERROR:', line);
      }
    }
  });

  railway.stderr.on('data', (data) => {
    const message = data.toString();

    // Filter out Railway CLI noise
    if (!message.includes('Connecting') && !message.includes('Connected')) {
      console.error('⚠️  Railway CLI:', message);
    }
  });

  railway.on('error', (err) => {
    console.error('❌ Failed to start Railway logs:', err.message);
    console.error('\n💡 Try running: railway login');
    console.error('📖 Or check: railway link\n');
    process.exit(1);
  });

  railway.on('close', (code) => {
    console.log(`\n❌ Railway logs stopped (exit code: ${code})`);
    console.log('💡 Run script again to resume monitoring\n');
    process.exit(code);
  });

  // Handle Ctrl+C gracefully
  process.on('SIGINT', () => {
    console.log('\n\n⏹️  Stopping webhook monitor...');
    console.log('✅ Goodbye!\n');
    railway.kill();
    process.exit(0);
  });
}

// Fallback instructions if script fails
process.on('uncaughtException', (err) => {
  console.error('\n❌ Unexpected error:', err.message);
  console.error('\n📖 Fallback options:');
  console.error('   1. View logs in Railway dashboard: https://railway.app/');
  console.error('   2. Look for "WISE WEBHOOK RECEIVED" in the logs');
  console.error('   3. Or use: railway logs --service business-accounting-system\n');
  process.exit(1);
});
