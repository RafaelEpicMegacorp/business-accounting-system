#!/usr/bin/env node

const API_URL = 'http://localhost:7393';

async function login() {
  console.log('🔐 Logging in...');
  const response = await fetch(`${API_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      username: 'rafael',
      password: 'asdflkj@3!'
    })
  });

  if (!response.ok) {
    throw new Error(`Login failed: ${response.status}`);
  }

  const data = await response.json();
  console.log('✓ Login successful\n');
  return data.token;
}

async function runCompleteSync(token) {
  console.log('🔄 Starting complete historical Wise sync...\n');
  console.log('=' .repeat(60));

  const response = await fetch(`${API_URL}/api/wise/sync`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(`Sync failed: ${response.status} - ${JSON.stringify(errorData)}`);
  }

  const result = await response.json();
  return result;
}

async function main() {
  try {
    const token = await login();
    const result = await runCompleteSync(token);

    console.log('\n' + '='.repeat(60));
    console.log('📊 SYNC RESULTS');
    console.log('='.repeat(60));
    console.log(`Success: ${result.success}`);
    console.log(`Message: ${result.message}\n`);

    if (result.stats) {
      console.log('Overall Stats:');
      console.log(`  Balances Processed: ${result.stats.balancesProcessed}`);
      console.log(`  Total Transactions Found: ${result.stats.transactionsFound}`);
      console.log(`  New Transactions: ${result.stats.newTransactions}`);
      console.log(`  Duplicates Skipped: ${result.stats.duplicatesSkipped}`);
      console.log(`  Entries Created: ${result.stats.entriesCreated}`);
      console.log(`  Errors: ${result.stats.errors}`);

      if (result.stats.currencyBreakdown) {
        console.log('\nPer-Currency Breakdown:');
        Object.keys(result.stats.currencyBreakdown).forEach(currency => {
          const cb = result.stats.currencyBreakdown[currency];
          console.log(`  ${currency}:`);
          console.log(`    Transactions Found: ${cb.transactionsFound}`);
          console.log(`    New Transactions: ${cb.newTransactions}`);
          console.log(`    Duplicates Skipped: ${cb.duplicatesSkipped}`);
          console.log(`    Entries Created: ${cb.entriesCreated}`);
          console.log(`    Current Balance: ${cb.currentBalance}`);
          if (cb.errors > 0) {
            console.log(`    Errors: ${cb.errors}`);
          }
        });
      }

      if (result.stats.errorDetails && result.stats.errorDetails.length > 0) {
        console.log('\n⚠️  Errors:');
        result.stats.errorDetails.slice(0, 5).forEach((err, i) => {
          console.log(`  ${i + 1}. ${err.currency || 'N/A'} - ${err.error}`);
        });
        if (result.stats.errorDetails.length > 5) {
          console.log(`  ... and ${result.stats.errorDetails.length - 5} more errors`);
        }
      }
    }

    console.log('\n✅ Complete historical sync finished!\n');

  } catch (error) {
    console.error('\n❌ ERROR:', error.message);
    process.exit(1);
  }
}

main();
