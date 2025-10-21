#!/usr/bin/env node

/**
 * Simple Real-Time Log Viewer
 *
 * Shows Railway logs in real-time with optional filtering
 *
 * Usage:
 *   node scripts/logs.js              # Show all logs
 *   node scripts/logs.js webhook      # Show only webhook-related logs
 *   node scripts/logs.js error        # Show only errors
 */

const { spawn } = require('child_process');

const filter = process.argv[2]?.toLowerCase();

console.log('╔' + '═'.repeat(63) + '╗');
console.log('║' + ' '.repeat(15) + 'Railway Logs - Real-Time Viewer' + ' '.repeat(17) + '║');
console.log('╚' + '═'.repeat(63) + '╝\n');

console.log('🔍 Service: business-accounting-system');
if (filter) {
  console.log(`🔎 Filter: "${filter}"`);
}
console.log('\n⏹️  Press Ctrl+C to stop\n');
console.log('─'.repeat(65) + '\n');

// Check if Railway CLI is available
const railwayCheck = spawn('railway', ['--version']);

railwayCheck.on('error', () => {
  console.error('❌ Railway CLI not found!\n');
  console.error('📦 Install with:');
  console.error('   npm install -g @railway/cli');
  console.error('   OR');
  console.error('   brew install railway\n');
  console.error('🔑 Then login:');
  console.error('   railway login\n');
  process.exit(1);
});

railwayCheck.on('close', (code) => {
  if (code === 0) {
    startWatching();
  }
});

function startWatching() {
  const railway = spawn('railway', ['logs', '--service', 'business-accounting-system']);

  railway.stdout.on('data', (data) => {
    const lines = data.toString().split('\n');

    lines.forEach(line => {
      if (!line.trim()) return;

      // Apply filter if specified
      if (filter) {
        const lowerLine = line.toLowerCase();
        if (filter === 'webhook' && !lowerLine.includes('webhook') && !lowerLine.includes('wise')) {
          return;
        }
        if (filter === 'error' && !lowerLine.includes('error') && !lowerLine.includes('❌')) {
          return;
        }
      }

      // Clean up timestamp if present
      const cleanLine = line.replace(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d+Z\s+/, '');

      // Add color/emoji based on content
      if (cleanLine.includes('ERROR') || cleanLine.includes('❌')) {
        console.log('🚨 ' + cleanLine);
      } else if (cleanLine.includes('WEBHOOK') || cleanLine.includes('🔔')) {
        console.log('📨 ' + cleanLine);
      } else if (cleanLine.includes('✅') || cleanLine.includes('SUCCESS')) {
        console.log('✅ ' + cleanLine);
      } else {
        console.log(cleanLine);
      }
    });
  });

  railway.stderr.on('data', (data) => {
    const message = data.toString();
    if (!message.includes('Connecting') && !message.includes('Connected')) {
      console.error('⚠️ ', message);
    }
  });

  railway.on('error', (err) => {
    console.error('\n❌ Failed to start Railway logs:', err.message);
    console.error('\n💡 Try: railway login\n');
    process.exit(1);
  });

  railway.on('close', (code) => {
    console.log(`\n⏹️  Logs stopped (exit code: ${code})\n`);
    process.exit(code);
  });

  // Graceful shutdown
  process.on('SIGINT', () => {
    console.log('\n\n⏹️  Stopping log viewer...');
    console.log('✅ Goodbye!\n');
    railway.kill();
    process.exit(0);
  });
}
