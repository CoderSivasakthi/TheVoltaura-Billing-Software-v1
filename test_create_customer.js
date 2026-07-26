require('dotenv').config();
const repo = require('./backend/repos/supabaseRepo');
async function test() {
  const c = await repo.createCustomer({ name: 'Test 2', tenant_id: 'test' });
  console.log(c);
}
test();
