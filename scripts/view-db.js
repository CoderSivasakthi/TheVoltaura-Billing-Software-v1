/**
 * view-db.js
 * Fetches and displays all records from the primary tables in Supabase.
 * Run with: node scripts/view-db.js
 */
require('dotenv').config();
const supa = require('../backend/repos/supabaseRepo');

async function viewData() {
  console.log('\n=============================================');
  console.log('📡 FETCHING LIVE DATABASE RECORDS');
  console.log('=============================================\n');

  try {
    // Customers
    console.log('--- CUSTOMERS ---');
    const customers = await supa.list('customers');
    if (customers && customers.length > 0) {
      console.table(customers.map(c => ({
        ID: c.customer_code,
        Name: (c.name?.firstName || '') + ' ' + (c.name?.lastName || ''),
        Phone: c.phone,
        Status: c.status
      })));
    } else {
      console.log('No customers found.\n');
    }

    // Products
    console.log('\n--- PRODUCTS ---');
    const products = await supa.list('products');
    if (products && products.length > 0) {
      console.table(products.map(p => ({
        SKU: p.sku,
        Name: p.name,
        Price: p.unit_price,
        Category: p.category
      })));
    } else {
      console.log('No products found.\n');
    }

    // Quotations
    console.log('\n--- QUOTATIONS ---');
    const quotations = await supa.list('quotations');
    if (quotations && quotations.length > 0) {
      console.table(quotations.map(q => ({
        QuotationNo: q.quotation_number,
        Customer: q.customer_id,
        Amount: q.total_amount,
        Status: q.status
      })));
    } else {
      console.log('No quotations found.\n');
    }

    // Invoices
    console.log('\n--- INVOICES ---');
    const invoices = await supa.list('invoices');
    if (invoices && invoices.length > 0) {
      console.table(invoices.map(i => ({
        InvoiceNo: i.invoice_number,
        Customer: i.customer_id,
        Amount: i.total_amount,
        Balance: i.balance_due,
        Status: i.status
      })));
    } else {
      console.log('No invoices found.\n');
    }

    // Payments
    console.log('\n--- PAYMENTS ---');
    const payments = await supa.list('payments');
    if (payments && payments.length > 0) {
      console.table(payments.map(p => ({
        PaymentNo: p.payment_number,
        Invoice: p.invoice_id,
        Amount: p.amount,
        Method: p.payment_method,
        Status: p.status
      })));
    } else {
      console.log('No payments found.\n');
    }

    // Orders
    console.log('\n--- ORDERS ---');
    const orders = await supa.list('orders');
    if (orders && orders.length > 0) {
      console.table(orders.map(o => ({
        OrderID: o.id,
        Quotation: o.quotation_id,
        Status: o.status,
        DeliveryDate: o.expected_delivery_date
      })));
    } else {
      console.log('No orders found.\n');
    }

    console.log('\n=============================================');
    console.log('✅ End of Database Records');
    console.log('Note: To see real-time additions when using the software,');
    console.log('keep an eye on the terminal running your backend server (node server.js).');
    console.log('It will log every creation and update instantly.');
    console.log('=============================================\n');

  } catch (error) {
    console.error('\n❌ ERROR FETCHING DATA:', error.message);
  }
}

viewData();
