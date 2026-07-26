require('dotenv').config();
const repo = require('./backend/repos/supabaseRepo.js');

async function test() {
    try {
        const payload = {
            title: 'Quotation Converted',
            desc: `Quotation 123 converted`,
            type: 'success',
            link: `/view-invoice/123`,
            read: false,
            createdAt: new Date().toISOString()
        };
        await repo.create('notifications', payload);
        console.log('Notification created successfully.');
    } catch(e) {
        console.error('Failed:', e);
    }
}
test();
