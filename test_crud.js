require('dotenv').config();
const supa = require('./backend/repos/supabaseRepo');

async function run() {
  console.log('Testing Supabase CRUD...');
  
  const isAvailable = supa.isAvailable();
  console.log('isAvailable:', isAvailable);
  if (!isAvailable) {
    console.log('Supabase not available, skipping.');
    return;
  }

  // 1. Create
  console.log('\n--- CREATE ---');
  const testId = 'CUST-TEST-' + Date.now();
  const created = await supa.create('customers', {
    id: testId,
    customer_code: testId,
    name: 'Test Customer ' + Date.now(),
    phone: '1234567890'
  });
  console.log(created ? 'SUCCESS' : 'FAILED');
  if (!created) return;

  const id = created.id;

  // 2. Read
  console.log('\n--- READ ---');
  const read = await supa.find('customers', id);
  console.log(read ? 'SUCCESS' : 'FAILED');

  // 3. Update
  console.log('\n--- UPDATE ---');
  const updated = await supa.update('customers', id, { phone: '0987654321' });
  console.log(updated ? 'SUCCESS' : 'FAILED');

  // 4. Delete
  console.log('\n--- DELETE ---');
  const deleted = await supa.remove('customers', id);
  console.log(deleted ? 'SUCCESS' : 'FAILED');

  // 5. List
  console.log('\n--- LIST ---');
  const list = await supa.list('customers');
  console.log(list && Array.isArray(list) ? `SUCCESS (Count: ${list.length})` : 'FAILED');
}

run().catch(console.error);
