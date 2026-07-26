require('dotenv').config();
const repo = require('./backend/repos/supabaseRepo.js');

async function test() {
    try {
        const payload = {
            id: 'QTVA2026270099', // dummy ID
            status: 'Quoted',
            customerName: 'Test',
            items: [], // JSONB
            totalAmount: 100,
            date: new Date().toISOString()
        };
        await repo.create('quotations', payload);
        console.log('Quotation created successfully.');
        
        await repo.update('quotations', 'QTVA2026270099', { status: 'Accepted' });
        console.log('Quotation updated successfully.');
        
        await repo.delete('quotations', 'QTVA2026270099');
        console.log('Quotation deleted successfully.');
        
    } catch(e) {
        console.error('Failed:', e);
    }
}
test();
