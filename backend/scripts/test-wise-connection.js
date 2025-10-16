require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const wiseService = require('../src/services/wiseService');

async function testWiseConnection() {
  console.log('🧪 Testing Wise API Connection...\n');

  try {
    // Test 1: Fetch profiles
    console.log('1️⃣ Fetching profiles...');
    const profiles = await wiseService.getProfiles();
    console.log(`✅ Found ${profiles.length} profile(s)`);

    if (profiles.length > 0) {
      const profile = profiles[0];
      console.log(`   Profile ID: ${profile.id}`);
      console.log(`   Profile Type: ${profile.type}`);
      console.log(`   Full Name: ${profile.details?.firstName} ${profile.details?.lastName || ''}`);

      // Test 2: Fetch balances
      console.log('\n2️⃣ Fetching balances...');
      const balances = await wiseService.getBalances(profile.id);
      console.log(`✅ Found ${balances.length} balance account(s)`);

      balances.forEach((balance, idx) => {
        console.log(`   ${idx + 1}. ${balance.currency}: ${balance.amount?.value || 0} ${balance.currency}`);
        console.log(`      Balance ID: ${balance.id}`);
      });

      // Test 3: Fetch recent transactions for first balance
      if (balances.length > 0) {
        console.log('\n3️⃣ Fetching recent transactions...');
        const balance = balances[0];
        const endDate = new Date();
        const startDate = new Date();
        startDate.setMonth(startDate.getMonth() - 3); // Last 3 months

        try {
          const statement = await wiseService.getStatement(
            profile.id,
            balance.id,
            balance.currency,
            startDate,
            endDate
          );

          const txCount = statement.transactions?.length || 0;
          console.log(`✅ Found ${txCount} transactions for ${balance.currency}`);

          if (txCount > 0) {
            console.log('\n   Sample transactions:');
            statement.transactions.slice(0, 3).forEach((tx, idx) => {
              console.log(`   ${idx + 1}. ${tx.date} - ${tx.details?.description || 'N/A'}`);
              console.log(`      Amount: ${tx.amount?.value} ${tx.amount?.currency}`);
              console.log(`      Type: ${tx.type}`);
            });
          }
        } catch (err) {
          console.log(`⚠️  Could not fetch transactions: ${err.message}`);
        }
      }

      // Test 4: Get exchange rates
      console.log('\n4️⃣ Fetching exchange rates...');
      const rates = await wiseService.getAllExchangeRates();
      console.log('✅ Current exchange rates (to USD):');
      Object.entries(rates).forEach(([currency, rate]) => {
        console.log(`   ${currency}: ${rate.toFixed(6)}`);
      });

      console.log('\n✨ All tests passed! Wise API is working correctly.');
      console.log(`\n💡 Save this Profile ID to your .env: WISE_PROFILE_ID=${profile.id}`);
    }
  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    console.error('\nFull error:', error);
    process.exit(1);
  }
}

testWiseConnection();
