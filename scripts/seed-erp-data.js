/**
 * seed-erp-data.js
 * Automatically inserts sample records into Customers, Products, Quotations, 
 * Invoices, Payments, and Orders, verifying that they appear in Supabase.
 * 
 * Run with: node scripts/seed-erp-data.js
 */
require('dotenv').config();
const supa = require('../backend/repos/supabaseRepo');

async function seedData() {
  console.log('===================================');
  console.log('FULL ERP DATABASE TEST (SEEDING)');
  console.log('===================================');

  try {
    // 1. Create a Customer
    console.log('\n[1/6] Creating Customer...');
    const customer = await supa.create('customers', {
      name: { firstName: 'Test', lastName: 'Customer', companyName: 'Solar Test Corp' },
      email: 'test@example.com',
      phone: '9999999999',
      status: 'Active'
    });
    if (!customer) throw new Error('Failed to create customer');

    // 2. Create a Product
    console.log('\n[2/6] Creating Product...');
    const product = await supa.create('products', {
      name: 'Test Solar Panel 550W',
      category: 'Solar Panels',
      sku: 'TEST-PANEL-01',
      unit_price: 15000
    });
    if (!product) throw new Error('Failed to create product');

    // 3. Create a Quotation
    console.log('\n[3/6] Creating Quotation...');
    const quotation = await supa.create('quotations', {
      customer_id: customer.id,
      quotation_number: `QTVA-2026-27-TEST${Date.now()}`,
      quotation_date: new Date().toISOString(),
      status: 'Accepted',
      total_amount: 150000,
      system_size_kw: 5
    });
    if (!quotation) throw new Error('Failed to create quotation');

    // 4. Create an Invoice
    console.log('\n[4/6] Generating Invoice...');
    const invoice = await supa.create('invoices', {
      quotation_id: quotation.id,
      customer_id: customer.id,
      invoice_number: `INVTVA-2026-27-TEST${Date.now()}`,
      invoice_date: new Date().toISOString(),
      due_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      status: 'Unpaid',
      total_amount: 150000,
      balance_due: 150000
    });
    if (!invoice) throw new Error('Failed to create invoice');

    // 5. Create a Payment
    console.log('\n[5/6] Recording Payment...');
    const payment = await supa.create('payments', {
      invoice_id: invoice.id,
      customer_id: customer.id,
      payment_number: `PAYVA-2026-27-TEST${Date.now()}`,
      payment_date: new Date().toISOString(),
      amount: 50000,
      payment_method: 'Bank Transfer',
      status: 'Completed',
      reference_number: 'UTR-TEST-12345'
    });
    if (!payment) throw new Error('Failed to create payment');

    // 6. Create an Order
    console.log('\n[6/6] Creating Order...');
    const order = await supa.create('orders', {
      quotation_id: quotation.id,
      customer_id: customer.id,
      status: 'Pending',
      delivery_address: '123 Solar Street',
      expected_delivery_date: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString()
    });
    if (!order) throw new Error('Failed to create order');

    console.log('\n===================================');
    console.log('✅ ALL TEST RECORDS CREATED SUCCESSFULLY');
    console.log('You can now verify these in the Supabase Table Editor.');
    console.log('===================================');

  } catch (error) {
    console.error('\n❌ SEED SCRIPT FAILED:', error.message);
  }
}

seedData();
