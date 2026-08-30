require('dotenv').config();
const supa = require('./backend/repos/supabaseRepo');

async function run() {
  console.log('Testing getUsers from Supabase...');
  const isAvailable = supa.isAvailable();
  if (!isAvailable) {
    console.log('Supabase not available.');
    return;
  }
  const users = await supa.list('users');
  console.log('Users length:', users ? users.length : 'null');
  console.log('Users:', users);
}

run().catch(console.error);
