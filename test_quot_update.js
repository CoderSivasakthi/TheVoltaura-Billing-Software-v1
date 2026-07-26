require('dotenv').config();
const repo = require('./backend/repos/supabaseRepo.js');

async function test() {
    try {
        const payload = {
            documents: {
                eb_receipt: 'test_url'
            },
            customerInfo: {
                customer_type: 'Residential'
            },
            status: 'Documents Pending'
        };
        const upd = await repo.update('quotations', 'QTVA2026270003', payload);
        console.log('Quotation updated successfully.', upd);
    } catch(e) {
        console.error('Failed:', e);
    }
}
test();
