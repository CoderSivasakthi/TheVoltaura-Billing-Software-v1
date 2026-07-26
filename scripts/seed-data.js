const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');

function write(name, data) {
  fs.writeFileSync(path.join(DATA_DIR, name), JSON.stringify(data, null, 2), 'utf8');
}

const now = new Date().toISOString();

write('organizations.json', [
  { id: 'org-1', name: 'Demo SolarCo', plan: 'trial', created_at: now }
]);

write('users.json', [
  { id: 'usr-1', organization_id: 'org-1', username: 'admin', password: 'admin', role: 'admin', created_at: now }
]);

write('customers.json', [
  { id: 'cust-1', organization_id: 'org-1', name: 'Ravi Enterprises', phone: '9876543210', gstin: '27ABCDE1234F1Z5', billing_address: { city: 'Chennai' }, created_at: now }
]);

write('products.json', [
  { id: 'prod-1', organization_id: 'org-1', sku: 'PANEL-330W', name: 'Solar Panel 330W', category: 'Panel', price: 12000, gst_rate: 12, stock: 50, created_at: now }
]);

write('invoices.json', []);
write('payments.json', []);
write('amc.json', []);
write('quotations.json', []);
write('purchase_orders.json', []);

console.log('Seed data written to data/');
