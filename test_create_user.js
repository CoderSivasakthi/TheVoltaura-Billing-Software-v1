require('dotenv').config();
const supa = require('./backend/repos/supabaseRepo');

async function run() {
  console.log('Testing create users from Supabase...');
  
  // Create without ID
  const created = await supa.create('users', {
    username: 'test_no_id',
    password: 'abc',
    role: 'user'
  });
  console.log('Created without ID:', created);

}

run().catch(console.error);
