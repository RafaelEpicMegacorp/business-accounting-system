const fetch = require('node-fetch');
require('dotenv').config();

const WISE_API_URL = process.env.WISE_API_URL;
const WISE_API_TOKEN = process.env.WISE_API_TOKEN;
const WISE_PROFILE_ID = process.env.WISE_PROFILE_ID;

async function testActivities() {
  try {
    console.log(`Fetching activities from ${WISE_API_URL}/v1/profiles/${WISE_PROFILE_ID}/activities`);

    const response = await fetch(
      `${WISE_API_URL}/v1/profiles/${WISE_PROFILE_ID}/activities`,
      {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${WISE_API_TOKEN}`,
          'Content-Type': 'application/json'
        }
      }
    );

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();

    console.log('\n✅ Success!');
    console.log('Total activities:', data.activities.length);

    console.log('\nActivity types:');
    const types = {};
    data.activities.forEach(a => {
      types[a.type] = (types[a.type] || 0) + 1;
    });
    console.log(JSON.stringify(types, null, 2));

    console.log('\nFirst 10 activities:');
    data.activities.slice(0, 10).forEach((a, i) => {
      console.log(`${i+1}. Type: ${a.type}, Description: ${a.description}, Amount: ${a.primaryAmount}, Status: ${a.status}`);
    });

    // Now let's fetch a few transfer details to see sourceAccount vs targetAccount
    console.log('\n\nChecking transfer details for first 3 TRANSFER activities:');
    const transfers = data.activities.filter(a => a.type === 'TRANSFER').slice(0, 3);

    for (const activity of transfers) {
      const transferId = activity.resource.id;
      const transferResponse = await fetch(
        `${WISE_API_URL}/v1/transfers/${transferId}`,
        {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${WISE_API_TOKEN}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (transferResponse.ok) {
        const transfer = await transferResponse.json();
        console.log(`\n📄 Transfer ${transferId}:`);
        console.log(`   - sourceAccount: ${transfer.sourceAccount || 'NULL'}`);
        console.log(`   - targetAccount: ${transfer.targetAccount || 'NULL'}`);
        console.log(`   - sourceValue: ${transfer.sourceValue}`);
        console.log(`   - targetValue: ${transfer.targetValue}`);
        console.log(`   - sourceCurrency: ${transfer.sourceCurrency}`);
        console.log(`   - Activity description: ${activity.description}`);
      }
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

testActivities();
