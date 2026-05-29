const { Client } = require('pg');
const client = new Client({
  connectionString: 'postgresql://postgres.pewtaqiljwqzzvzcoscf:Bo37zap3BkeWhfom@aws-1-eu-west-1.pooler.supabase.com:5432/postgres'
});
client.connect()
  .then(() => {
    console.log('Connected successfully!');
    return client.end();
  })
  .catch(err => {
    console.error('Connection error:', err.message);
  });
