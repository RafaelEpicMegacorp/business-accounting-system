require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const pool = require('../src/config/database');

// Exchange rates for Aug-Sep 2025 (Wise mid-market rates)
const EXCHANGE_RATES = {
  'USD': 1.000000,
  'EUR': 1.160000, // EUR to USD
  'GBP': 1.320000, // GBP to USD
  'PLN': 0.250000  // PLN to USD (approximate, will be refined from statements)
};

// Employee ID mappings (will be fetched from DB)
const EMPLOYEES = {};

// Fetch employee IDs
async function fetchEmployees() {
  const result = await pool.query('SELECT id, name FROM employees');
  result.rows.forEach(emp => {
    EMPLOYEES[emp.name] = emp.id;
    // Also map partial/similar names
    if (emp.name === 'Celso Rafael Vieira') {
      EMPLOYEES['Celso Rafael Vieira wojMAZOWIECKIEpow'] = emp.id;
    }
    if (emp.name === 'Abhijeet Govindrao Rananaware') {
      EMPLOYEES['ABHIJEET GOVINDRAO RANANAWARE'] = emp.id;
    }
    if (emp.name === 'Muhammad Asif') {
      EMPLOYEES['Muhammad Asif'] = emp.id;
    }
    if (emp.name === 'Maryana Budzovych') {
      EMPLOYEES['Maryana Budzovych'] = emp.id;
    }
  });
  console.log('✓ Loaded', result.rows.length, 'employees');
}

// Helper to convert amount to USD
function toUSD(amount, currency) {
  const rate = EXCHANGE_RATES[currency] || 1;
  return amount * rate;
}

// Transaction data extracted from statements
// Format: { date, description, amount, currency, type, category, employeeRef, reference }
const transactions = [
  // ============================================
  // AUGUST 2025 - USD ACCOUNT
  // ============================================

  // Income from ZIDAN MANAGEMENT GROUP INC
  { date: '2025-08-22', description: 'ZIDAN MANAGEMENT GROUP INC', amount: 9500.00, currency: 'USD', type: 'income', category: 'Client Payment', reference: '20250822MMQFMP2N014072' },
  { date: '2025-08-25', description: 'ZIDAN MANAGEMENT GROUP INC', amount: 9500.00, currency: 'USD', type: 'income', category: 'Client Payment', reference: '20250825MMQFMP2K012739' },
  { date: '2025-08-26', description: 'ZIDAN MANAGEMENT GROUP INC', amount: 9500.00, currency: 'USD', type: 'income', category: 'Client Payment', reference: '20250826MMQFMP2L012228' },
  { date: '2025-08-27', description: 'ZIDAN MANAGEMENT GROUP INC', amount: 9500.00, currency: 'USD', type: 'income', category: 'Client Payment', reference: '20250827MMQFMP2K007657' },
  { date: '2025-08-28', description: 'ZIDAN MANAGEMENT GROUP INC', amount: 9000.00, currency: 'USD', type: 'income', category: 'Client Payment', reference: '20250828MMQFMP2M019902' },

  // Salary Payments - August
  { date: '2025-08-22', description: 'Salary Payment', amount: 5000.00, currency: 'USD', type: 'expense', category: 'Salary', employeeRef: 'Celso Rafael Vieira wojMAZOWIECKIEpow', reference: 'TRANSFER-1686072832' },
  { date: '2025-08-22', description: 'Salary Payment', amount: 994.79, currency: 'USD', type: 'expense', category: 'Salary', employeeRef: 'ABHIJEET GOVINDRAO RANANAWARE', reference: 'TRANSFER-1686141697' },
  { date: '2025-08-25', description: 'Salary Payment', amount: 5000.00, currency: 'USD', type: 'expense', category: 'Salary', employeeRef: 'Celso Rafael Vieira wojMAZOWIECKIEpow', reference: 'TRANSFER-1689863259' },
  { date: '2025-08-25', description: 'Salary Payment', amount: 994.79, currency: 'USD', type: 'expense', category: 'Salary', employeeRef: 'ABHIJEET GOVINDRAO RANANAWARE', reference: 'TRANSFER-1689862268' },
  { date: '2025-08-26', description: 'Salary Payment', amount: 994.79, currency: 'USD', type: 'expense', category: 'Salary', employeeRef: 'ABHIJEET GOVINDRAO RANANAWARE', reference: 'TRANSFER-1691245796' },
  { date: '2025-08-27', description: 'Salary Payment', amount: 994.80, currency: 'USD', type: 'expense', category: 'Salary', employeeRef: 'ABHIJEET GOVINDRAO RANANAWARE', reference: 'TRANSFER-1692671080' },
  { date: '2025-08-28', description: 'Salary Payment', amount: 994.79, currency: 'USD', type: 'expense', category: 'Salary', employeeRef: 'ABHIJEET GOVINDRAO RANANAWARE', reference: 'TRANSFER-1694551780' },
  { date: '2025-08-29', description: 'Salary Payment', amount: 5000.00, currency: 'USD', type: 'expense', category: 'Salary', employeeRef: 'Celso Rafael Vieira wojMAZOWIECKIEpow', reference: 'TRANSFER-1695324950' },

  // Business Expenses - August
  { date: '2025-08-26', description: 'Finalab Spz oo - Invoice FV 140', amount: 670.81, currency: 'USD', type: 'expense', category: 'Office Rent', reference: 'TRANSFER-1690773260' },
  { date: '2025-08-26', description: 'Finalab Spz oo - Invoice FV 141', amount: 402.50, currency: 'USD', type: 'expense', category: 'Office Rent', reference: 'TRANSFER-1690775658' },
  { date: '2025-08-26', description: 'Finalab Spz oo - Invoice FV 142', amount: 33.55, currency: 'USD', type: 'expense', category: 'Office Rent', reference: 'TRANSFER-1690777469' },
  { date: '2025-08-26', description: 'Motion Temp Hold', amount: 1.00, currency: 'USD', type: 'expense', category: 'Software', reference: 'CARD-2830970133' },
  { date: '2025-08-25', description: 'Netland Computers SpKALISZ', amount: 1695.51, currency: 'USD', type: 'expense', category: 'Equipment', reference: 'CARD-2828969829' },
  { date: '2025-08-25', description: 'The Brain Embassy WARSZAWA', amount: 82.20, currency: 'USD', type: 'expense', category: 'Office Rent', reference: 'CARD-2827617107' },
  { date: '2025-08-25', description: 'The Brain Embassy WARSZAWA', amount: 404.67, currency: 'USD', type: 'expense', category: 'Office Rent', reference: 'CARD-2827615429' },
  { date: '2025-08-26', description: 'Empik SaWARSZAWA', amount: 95.37, currency: 'USD', type: 'expense', category: 'Business Meals', reference: 'CARD-2832516335' },
  { date: '2025-08-27', description: 'Amic Polska SpZ OWARSZAWA', amount: 72.60, currency: 'USD', type: 'expense', category: 'Business Meals', reference: 'CARD-2834131778' },
  { date: '2025-08-27', description: 'Fs *Manytrickscom fsprgnl', amount: 15.72, currency: 'USD', type: 'expense', category: 'Software', reference: 'CARD-2834436905' },
  { date: '2025-08-28', description: 'Upwork -jobpost', amount: 31.60, currency: 'USD', type: 'expense', category: 'Salary', reference: 'CARD-2838592837' }, // Upwork fee = part of salary cost

  // ============================================
  // SEPTEMBER 2025 - USD ACCOUNT
  // ============================================

  // Income from ZIDAN (September)
  { date: '2025-09-19', description: 'ZIDAN MANAGEMENT GROUP INC', amount: 9500.00, currency: 'USD', type: 'income', category: 'Client Payment', reference: '20250919MMQFMP2M016689' },
  { date: '2025-09-23', description: 'ZIDAN MANAGEMENT GROUP INC', amount: 9500.00, currency: 'USD', type: 'income', category: 'Client Payment', reference: '20250923MMQFMP2N005057' },
  { date: '2025-09-25', description: 'ZIDAN MANAGEMENT GROUP INC', amount: 9500.00, currency: 'USD', type: 'income', category: 'Client Payment', reference: '20250925MMQFMP2M017324' },
  { date: '2025-09-26', description: 'ZIDAN MANAGEMENT GROUP INC', amount: 9500.00, currency: 'USD', type: 'income', category: 'Client Payment', reference: '20250926MMQFMP2K027091' },
  { date: '2025-09-29', description: 'ZIDAN MANAGEMENT GROUP INC', amount: 9500.00, currency: 'USD', type: 'income', category: 'Client Payment', reference: '20250929MMQFMP2L037791' },

  // Income from GRATUITY SYSTEMS (EUR account, converted)
  { date: '2025-09-10', description: 'GRATUITY SYSTEMS INTERNATIONAL PTE. LTD.', amount: 1500.00, currency: 'EUR', type: 'income', category: 'Client Payment', reference: '930294' },

  // Salary Payments - September
  { date: '2025-09-23', description: 'Salary Payment', amount: 4985.05, currency: 'USD', type: 'expense', category: 'Salary', employeeRef: 'Celso Rafael Vieira wojMAZOWIECKIEpow', reference: 'TRANSFER-1735319732' },
  { date: '2025-09-26', description: 'Salary Payment', amount: 2991.77, currency: 'USD', type: 'expense', category: 'Salary', employeeRef: 'Celso Rafael Vieira wojMAZOWIECKIEpow', reference: 'TRANSFER-1740889688' },
  { date: '2025-09-30', description: 'Salary Payment to Muhammad Asif', amount: 678.76, currency: 'USD', type: 'expense', category: 'Salary', employeeRef: 'Muhammad Asif', reference: 'TRANSFER-1746902459' },

  // Business Expenses - Maryana Car Rental
  { date: '2025-09-26', description: 'Maryana Budzovych - Car Rental August', amount: 1641.70, currency: 'USD', type: 'expense', category: 'Transportation', employeeRef: 'Maryana Budzovych', reference: 'TRANSFER-1739854514' },

  // Software Expenses - September
  { date: '2025-09-08', description: 'Claude AI Subscription', amount: 105.63, currency: 'EUR', type: 'expense', category: 'Software', reference: 'CARD-2877262395' },
  { date: '2025-09-08', description: 'Microsoft Store', amount: 1.00, currency: 'USD', type: 'expense', category: 'Software', reference: 'CARD-2876172351' },
  { date: '2025-09-06', description: 'Slack DUBLIN', amount: 23.03, currency: 'USD', type: 'expense', category: 'Software', reference: 'CARD-2870988030' },
  { date: '2025-09-04', description: 'Read - Meeting Manager', amount: 29.75, currency: 'USD', type: 'expense', category: 'Software', reference: 'CARD-2863363201' },
  { date: '2025-09-07', description: 'Lemsqzy* Onlabs LEMONSQUEEZY', amount: 23.36, currency: 'USD', type: 'expense', category: 'Software', reference: 'CARD-2873988549' },
  { date: '2025-09-15', description: 'Hedy AI', amount: 9.99, currency: 'USD', type: 'expense', category: 'Software', reference: 'CARD-2901315704' },
  { date: '2025-09-26', description: 'GitLab Inc', amount: 20.00, currency: 'USD', type: 'expense', category: 'Software', reference: 'CARD-2941310050' },
  { date: '2025-09-25', description: 'ClickUp', amount: 7.60, currency: 'USD', type: 'expense', category: 'Software', reference: 'CARD-2937960750' },
  { date: '2025-09-24', description: 'ClickUp', amount: 12.37, currency: 'USD', type: 'expense', category: 'Software', reference: 'CARD-2934666642' },
  { date: '2025-09-10', description: 'Apple.com/bill', amount: 90.54, currency: 'USD', type: 'expense', category: 'Software', reference: 'CARD-2883164510' },

  // Equipment - September
  { date: '2025-09-19', description: 'Sony Centre Wola Park WARSZAWA', amount: 964.83, currency: 'USD', type: 'expense', category: 'Equipment', reference: 'CARD-2916708938' },
  { date: '2025-09-18', description: 'Mediaexpert Pl ZLOTOW', amount: 137.91, currency: 'USD', type: 'expense', category: 'Equipment', reference: 'CARD-2913688632' },
  { date: '2025-09-20', description: 'Allegro Poznan', amount: 1027.65, currency: 'USD', type: 'expense', category: 'Equipment', reference: 'CARD-2922380255' },
  { date: '2025-09-21', description: 'Allegro Poznan', amount: 37.74, currency: 'USD', type: 'expense', category: 'Equipment', reference: 'CARD-2925442405' },

  // Office Rent - September
  { date: '2025-09-06', description: 'Flatte WARSZAWA', amount: 1774.37, currency: 'USD', type: 'expense', category: 'Office Rent', reference: 'CARD-2870256490' },
  { date: '2025-09-27', description: 'Flatte WARSZAWA', amount: 768.00, currency: 'USD', type: 'expense', category: 'Office Rent', reference: 'CARD-2945250096' },
  { date: '2025-09-30', description: 'Flatte WARSZAWA', amount: 164.97, currency: 'USD', type: 'expense', category: 'Office Rent', reference: 'CARD-2956000319' },
  { date: '2025-09-25', description: 'Finalab Spz oo - FV 189', amount: 1476.00, currency: 'PLN', type: 'expense', category: 'Office Rent', reference: 'TRANSFER-1738497264' },
  { date: '2025-09-25', description: 'Finalab Spz oo - FV 171', amount: 369.00, currency: 'PLN', type: 'expense', category: 'Office Rent', reference: 'TRANSFER-1738499072' },

  // Business Meals - September
  { date: '2025-09-27', description: 'Barista Skill WARSZAWA', amount: 35.66, currency: 'USD', type: 'expense', category: 'Business Meals', reference: 'CARD-2946232153' },
  { date: '2025-09-29', description: 'Maracatu WARSZAWA', amount: 27.16, currency: 'USD', type: 'expense', category: 'Business Meals', reference: 'CARD-2953060438' },
  { date: '2025-09-29', description: 'Chorchos Brand Lukasz', amount: 39.80, currency: 'USD', type: 'expense', category: 'Business Meals', reference: 'CARD-2952965089' },
  { date: '2025-09-30', description: 'Bolteu/d/Viimsi', amount: 36.18, currency: 'USD', type: 'expense', category: 'Transportation', reference: 'CARD-2957915287' },

  // Travel - September
  { date: '2025-09-23', description: 'Hotel At Bookingcom Amsterdam', amount: 1019.96, currency: 'USD', type: 'expense', category: 'Travel', reference: 'CARD-2932253800' },
  { date: '2025-09-24', description: 'Hotel At Bookingcom Amsterdam', amount: 702.41, currency: 'EUR', type: 'expense', category: 'Travel', reference: 'CARD-2934130681' },
  { date: '2025-09-24', description: 'Taxis On Booking Amsterdam', amount: 167.79, currency: 'USD', type: 'expense', category: 'Transportation', reference: 'CARD-2934094801' },

  // Upwork Fees (Salary related) - September
  { date: '2025-09-07', description: 'Upwork -jobpost', amount: 31.32, currency: 'USD', type: 'expense', category: 'Salary', reference: 'CARD-2873834240' },
  { date: '2025-09-09', description: 'Upwork -ref', amount: 547.39, currency: 'USD', type: 'expense', category: 'Salary', reference: 'CARD-2879558710' },
  { date: '2025-09-13', description: 'Upwork -ref', amount: 27.15, currency: 'USD', type: 'expense', category: 'Salary', reference: 'CARD-2896076532' },
  { date: '2025-09-16', description: 'Upwork -ref', amount: 1621.19, currency: 'USD', type: 'expense', category: 'Salary', reference: 'CARD-2905005768' },
  { date: '2025-09-19', description: 'Upwork -ref', amount: 87.55, currency: 'USD', type: 'expense', category: 'Salary', reference: 'CARD-2915828374' },
  { date: '2025-09-22', description: 'Upwork -ref', amount: 779.38, currency: 'USD', type: 'expense', category: 'Salary', reference: 'CARD-2927414381' },
  { date: '2025-09-22', description: 'Upwork -ref', amount: 2112.07, currency: 'USD', type: 'expense', category: 'Salary', reference: 'CARD-2929305909' },
  { date: '2025-09-24', description: 'Upwork -ref', amount: 418.73, currency: 'USD', type: 'expense', category: 'Salary', reference: 'CARD-2934821459' },
  { date: '2025-09-26', description: 'Upwork -ref', amount: 266.65, currency: 'USD', type: 'expense', category: 'Salary', reference: 'CARD-2941578662' },
  { date: '2025-09-26', description: 'Upwork -ref', amount: 821.74, currency: 'USD', type: 'expense', category: 'Salary', reference: 'CARD-2942459060' },
  { date: '2025-09-29', description: 'Upwork -jobpost', amount: 31.37, currency: 'USD', type: 'expense', category: 'Salary', reference: 'CARD-2952541141' },
  { date: '2025-09-29', description: 'Upwork -jobpost', amount: 31.40, currency: 'USD', type: 'expense', category: 'Salary', reference: 'CARD-2952387098' },

  // LinkedIn Job Postings (Recruiting/HR)
  { date: '2025-09-14', description: 'Linkedin Job PDublin', amount: 474.00, currency: 'EUR', type: 'expense', category: 'Salary', reference: 'CARD-2897791627' },
  { date: '2025-09-16', description: 'Linkedin Job PDublin', amount: 88.00, currency: 'EUR', type: 'expense', category: 'Salary', reference: 'CARD-2905774077' },
  { date: '2025-09-22', description: 'Linkedin Job PDublin (Claude AI)', amount: 90.00, currency: 'EUR', type: 'expense', category: 'Software', reference: 'CARD-2927765158' },

  // Service Subscriptions
  { date: '2025-09-11', description: 'Uloop Inc', amount: 125.00, currency: 'USD', type: 'expense', category: 'Software', reference: 'CARD-2887220519' },
  { date: '2025-09-15', description: 'Wise Card Acquisition', amount: 5.54, currency: 'USD', type: 'expense', category: 'Administration', reference: 'CARD_ORDER_CHECKOUT-invoice-20271448' },
  { date: '2025-09-04', description: 'Cashback', amount: 7.86, currency: 'USD', type: 'income', category: 'Other Income', reference: 'BALANCE_CASHBACK' },
];

// Main import function
async function importTransactions() {
  try {
    console.log('Starting bank statement import...\n');

    // Fetch employees
    await fetchEmployees();

    // Clean existing entries
    console.log('\n📝 Cleaning existing entries...');
    const deleteResult = await pool.query('DELETE FROM entries WHERE entry_date >= $1', ['2025-08-01']);
    console.log(`✓ Deleted ${deleteResult.rowCount} existing entries from Aug-Sep 2025\n`);

    // Import transactions
    console.log('📥 Importing', transactions.length, 'transactions...\n');

    let imported = 0;
    let skipped = 0;

    for (const tx of transactions) {
      const usdAmount = toUSD(tx.amount, tx.currency);
      const employeeId = tx.employeeRef ? EMPLOYEES[tx.employeeRef] : null;

      // Skip if employee reference not found
      if (tx.employeeRef && !employeeId) {
        console.log(`⚠️  Skipped: ${tx.description} - Employee "${tx.employeeRef}" not found`);
        skipped++;
        continue;
      }

      try {
        await pool.query(`
          INSERT INTO entries (
            type, category, description, detail,
            base_amount, total, entry_date, status,
            employee_id, bank_account,
            original_currency, original_amount, exchange_rate,
            transaction_reference
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
        `, [
          tx.type,
          tx.category,
          tx.description,
          tx.reference,
          usdAmount,
          usdAmount,
          tx.date,
          'completed',
          employeeId,
          tx.currency === 'USD' ? 'USD' : (tx.currency === 'EUR' ? 'EUR' : (tx.currency === 'GBP' ? 'GBP' : 'PLN')),
          tx.currency,
          tx.amount,
          EXCHANGE_RATES[tx.currency],
          tx.reference
        ]);

        imported++;
        if (imported % 10 === 0) {
          console.log(`  ... imported ${imported} transactions`);
        }
      } catch (err) {
        console.error(`❌ Error importing transaction:`, tx.description, err.message);
      }
    }

    console.log(`\n✅ Import complete!`);
    console.log(`   Imported: ${imported}`);
    console.log(`   Skipped: ${skipped}`);

    // Generate summary
    console.log('\n📊 Generating summary...\n');

    const summary = await pool.query(`
      SELECT
        type,
        category,
        bank_account,
        COUNT(*) as transaction_count,
        SUM(total) as total_usd
      FROM entries
      WHERE entry_date >= '2025-08-01' AND entry_date < '2025-10-01'
      GROUP BY type, category, bank_account
      ORDER BY type, category, bank_account
    `);

    console.log('Summary by Category:\n');
    console.table(summary.rows.map(r => ({
      Type: r.type,
      Category: r.category,
      Bank: r.bank_account,
      Count: r.transaction_count,
      'Total (USD)': `$${parseFloat(r.total_usd).toLocaleString('en-US', {minimumFractionDigits: 2})}`
    })));

    // Overall totals
    const totals = await pool.query(`
      SELECT
        type,
        COUNT(*) as count,
        SUM(total) as total
      FROM entries
      WHERE entry_date >= '2025-08-01' AND entry_date < '2025-10-01'
      GROUP BY type
    `);

    console.log('\n💰 Overall Totals (Aug-Sep 2025):\n');
    let totalIncome = 0;
    let totalExpense = 0;

    totals.rows.forEach(r => {
      const amount = parseFloat(r.total);
      if (r.type === 'income') totalIncome = amount;
      if (r.type === 'expense') totalExpense = amount;
      console.log(`   ${r.type.toUpperCase()}: ${r.count} transactions = $${amount.toLocaleString('en-US', {minimumFractionDigits: 2})}`);
    });

    const netIncome = totalIncome - totalExpense;
    console.log(`\n   NET INCOME: $${netIncome.toLocaleString('en-US', {minimumFractionDigits: 2, signDisplay: 'always'})}`);
    console.log('\n✨ Import script completed successfully!\n');

  } catch (error) {
    console.error('❌ Import failed:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

// Run import
importTransactions().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
