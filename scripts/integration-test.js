const fetch = global.fetch || require('node-fetch');
const { spawn } = require('child_process');
const base = 'http://localhost:5001';

async function waitForServer(timeout = 10000) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    try {
      const res = await fetch(base + '/api/customers');
      if (res && res.status < 500) return true;
    } catch (e) {
      // ignore
    }
    await new Promise(r => setTimeout(r, 300));
  }
  return false;
}

async function run() {
  console.log('Starting server for integration tests...');
  const serverProc = spawn(process.execPath, ['server.js'], { cwd: __dirname + '/../', stdio: 'inherit' });

  const ready = await waitForServer(10000);
  if (!ready) {
    console.error('Server did not start in time');
    serverProc.kill();
    process.exit(2);
  }

  console.log('Running integration tests...');

  // Create a customer
  let res = await fetch(base + '/api/customers', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-demo-auth': 'demo-token-12345' }, body: JSON.stringify({ name: 'IT Test Customer', phone: '9999999999' }) });
  console.log('POST /api/customers', res.status);

  const list = await (await fetch(base + '/api/customers')).json();
  console.log('Customers count:', list.length);

  // Create an invoice for the customer
  const invoicePayload = { customer: list[0], items: [{ product_id: 'prod-1', description: 'Panel', quantity: 2, unit_price: 12000 }], subtotal: 24000, gst: 0, total: 24000 };
  res = await fetch(base + '/api/invoices', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-demo-auth': 'demo-token-12345' }, body: JSON.stringify(invoicePayload) });
  console.log('POST /api/invoices', res.status);
  const invoice = await res.json();

  // Post a payment against the invoice
  const paymentPayload = { invoiceId: invoice.id, date: new Date().toISOString(), amount: invoice.total };
  res = await fetch(base + '/api/payments', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-demo-auth': 'demo-token-12345' }, body: JSON.stringify(paymentPayload) });
  console.log('POST /api/payments', res.status);

  // Check ledger entries were created
  const ledgers = await (await fetch(base + '/ledger_entries')).json().catch(() => null);
  if (ledgers && ledgers.length > 0) console.log('Ledger entries present:', ledgers.length);

  console.log('Integration tests completed');

  serverProc.kill();
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
