// Backfill amount_usd for existing entries
// Run once to update entries that don't have amount_usd set

const pool = require('../src/config/database');

const exchangeRateCache = new Map();

async function getExchangeRateToUSD(currency, amount) {
  if (currency === 'USD' || !currency) {
    return { rate: 1, amountUsd: amount };
  }

  const cacheKey = currency;
  const cached = exchangeRateCache.get(cacheKey);
  if (cached) {
    return { rate: cached, amountUsd: amount * cached };
  }

  try {
    const response = await fetch(`https://api.exchangerate-api.com/v4/latest/${currency}`);
    if (!response.ok) {
      console.warn(`Failed to get exchange rate for ${currency}, using 1:1`);
      return { rate: 1, amountUsd: amount };
    }
    const data = await response.json();
    const rate = data.rates.USD || 1;
    exchangeRateCache.set(cacheKey, rate);
    return { rate, amountUsd: amount * rate };
  } catch (error) {
    console.warn(`Exchange rate API error for ${currency}:`, error.message);
    return { rate: 1, amountUsd: amount };
  }
}

async function backfillAmountUsd() {
  console.log('Starting backfill of amount_usd for existing entries...\n');

  // Get all entries without amount_usd
  const result = await pool.query(`
    SELECT id, total, currency
    FROM entries
    WHERE amount_usd IS NULL
    ORDER BY id
  `);

  console.log(`Found ${result.rows.length} entries without amount_usd\n`);

  if (result.rows.length === 0) {
    console.log('All entries already have amount_usd set. Nothing to do.');
    return;
  }

  let updated = 0;
  let errors = 0;

  for (const entry of result.rows) {
    try {
      const currency = entry.currency || 'USD';
      const amount = parseFloat(entry.total);
      const { rate, amountUsd } = await getExchangeRateToUSD(currency, amount);

      await pool.query(`
        UPDATE entries
        SET amount_usd = $1, exchange_rate = $2
        WHERE id = $3
      `, [amountUsd, rate, entry.id]);

      updated++;
      if (updated % 50 === 0) {
        console.log(`  Updated ${updated}/${result.rows.length} entries...`);
      }
    } catch (error) {
      errors++;
      console.error(`  Error updating entry ${entry.id}:`, error.message);
    }
  }

  console.log(`\nBackfill complete!`);
  console.log(`  Updated: ${updated}`);
  console.log(`  Errors: ${errors}`);
}

// Wait for database connection before starting
setTimeout(() => {
  backfillAmountUsd()
    .then(() => {
      console.log('\nDone.');
      process.exit(0);
    })
    .catch(error => {
      console.error('Fatal error:', error);
      process.exit(1);
    });
}, 2000);
