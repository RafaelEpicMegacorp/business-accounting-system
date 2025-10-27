#!/usr/bin/env node

const { Client } = require('pg');

const client = new Client({
  connectionString: 'postgresql://postgres:iiijaeSBDPUckvGWSopVfrJmvlpNzmDp@gondola.proxy.rlwy.net:41656/railway'
});

let lastCheckTime = new Date();
let lastWebhookId = 0;

async function checkNewWebhooks() {
  try {
    const result = await client.query(`
      SELECT
        id,
        action,
        notes,
        new_values->>'event_type' as event_type,
        created_at
      FROM wise_sync_audit_log
      WHERE action LIKE 'webhook_%'
        AND id > $1
      ORDER BY created_at DESC
    `, [lastWebhookId]);

    if (result.rows.length > 0) {
      console.log(`\n🔔 ${result.rows.length} NEW WEBHOOK(S) DETECTED!\n`);

      result.rows.forEach(row => {
        console.log('=' .repeat(60));
        console.log(`📋 ID: ${row.id}`);
        console.log(`⚡ Action: ${row.action}`);
        console.log(`🏷️  Event Type: ${row.event_type || 'N/A'}`);
        console.log(`📝 Notes: ${row.notes}`);
        console.log(`🕐 Created: ${row.created_at}`);
        console.log('='.repeat(60));

        if (row.id > lastWebhookId) {
          lastWebhookId = row.id;
        }
      });
    }

    lastCheckTime = new Date();

  } catch (error) {
    console.error('❌ Error checking webhooks:', error.message);
  }
}

async function start() {
  console.log('🚀 Starting Real-Time Webhook Monitor');
  console.log('=' .repeat(60));
  console.log('📡 Monitoring database for new webhooks...');
  console.log('🔄 Checking every 2 seconds');
  console.log('=' .repeat(60));
  console.log('\n👉 Now trigger a webhook from Wise...\n');

  await client.connect();

  // Get the latest webhook ID to start monitoring from
  const result = await client.query(`
    SELECT MAX(id) as max_id FROM wise_sync_audit_log WHERE action LIKE 'webhook_%'
  `);
  lastWebhookId = result.rows[0].max_id || 0;
  console.log(`📊 Starting from webhook ID: ${lastWebhookId}\n`);

  // Check every 2 seconds
  setInterval(checkNewWebhooks, 2000);

  // Also log a heartbeat every 10 seconds
  setInterval(() => {
    console.log(`💓 Monitoring... (Last check: ${lastCheckTime.toLocaleTimeString()})`);
  }, 10000);
}

start().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});

// Handle Ctrl+C
process.on('SIGINT', async () => {
  console.log('\n\n👋 Stopping monitor...');
  await client.end();
  process.exit(0);
});
