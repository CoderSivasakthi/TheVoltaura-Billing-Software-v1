require('dotenv').config();
const repo = require('./backend/repos/supabaseRepo.js');

async function test() {
    try {
        const payload = {
            id: 'QTVA2026270100', // dummy ID
            companyBranchId: 'b1',
            companyGst: 'gst',
            companyAddress: 'addr',
            customerId: 'c1',
            customerName: 'Customer',
            date: new Date().toISOString(),
            billingAddr: 'addr',
            siteAddr: 'addr',
            notes: 'notes',
            discount: 0,
            status: 'Quoted',
            items: [],
            subtotal: 100,
            totalTax: 10,
            grandTotal: 110,
            total: 110,
            customerInfo: {},
            documents: {}
        };
        await repo.create('quotations', payload);
        console.log('Quotation created successfully.');
    } catch(e) {
        console.error('Failed:', e);
    }
}
test();
