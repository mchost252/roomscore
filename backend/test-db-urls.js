const { Client } = require('pg');

async function testConnection(url, name) {
  const client = new Client({ connectionString: url, connectionTimeoutMillis: 5000 });
  try {
    await client.connect();
    console.log(`✅ [${name}] CONNECTED SUCCESSFULLY!`);
    await client.end();
    return true;
  } catch (err) {
    console.error(`❌ [${name}] FAILED:`, err.message);
    return false;
  }
}

async function runTests() {
  const url0 = 'postgresql://postgres.pewtaqiljwqzzvzcoscf:Bo37zap3BkeWhfom@aws-0-eu-central-1.pooler.supabase.com:5432/postgres';
  const url1 = 'postgresql://postgres.pewtaqiljwqzzvzcoscf:Bo37zap3BkeWhfom@aws-1-eu-west-1.pooler.supabase.com:5432/postgres';
  const url2 = 'postgresql://postgres.pewtaqiljwqzzvzcoscf:Bo37zap3BkeWhfom@aws-0-eu-central-1.pooler.supabase.com:6543/postgres';
  const direct = 'postgresql://postgres:Bo37zap3BkeWhfom@db.pewtaqiljwqzzvzcoscf.supabase.co:5432/postgres';

  console.log('Testing pooler 5432 (eu-central-1)...');
  await testConnection(url0, 'aws-0-eu-central-1:5432');
  
  console.log('\nTesting pooler 5432 (eu-west-1)...');
  await testConnection(url1, 'aws-1-eu-west-1:5432');

  console.log('\nTesting pooler 6543 (eu-central-1)...');
  await testConnection(url2, 'aws-0-eu-central-1:6543');

  console.log('\nTesting direct connection (db.pewtaqiljwqzzvzcoscf)...');
  await testConnection(direct, 'db.pewtaqiljwqzzvzcoscf:5432');
}

runTests();
