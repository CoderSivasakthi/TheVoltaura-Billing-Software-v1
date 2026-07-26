require('dotenv').config();
const { Client } = require('pg');

async function run() {
    const c = new Client({connectionString: process.env.DATABASE_URL});
    await c.connect();
    
    // get an invoice with a valid customer
    const res = await c.query("SELECT * FROM invoices WHERE customer_id IN ('CUST-000001', 'CUST-000002', 'CUST-000003') LIMIT 1");
    if (res.rows.length === 0) {
        console.log("No valid invoices found to test");
        return;
    }
    const inv = res.rows[0];
    console.log("Found invoice:", inv.id, "for customer:", inv.customer_id);

    // Call local api to test payment
    const body = {
        invoiceId: inv.id,
        amount: 5000,
        date: new Date().toISOString().split('T')[0],
        method: 'Bank Transfer',
        paymentType: 'Advance',
        notes: 'Test API workflow',
        customerId: inv.customer_id,
        customerName: inv.customer_name
    };
    
    const http = require('http');
    const options = {
        hostname: 'localhost',
        port: 5001,
        path: '/api/auth/login',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
    };
    const req = http.request(options, res => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
            const token = JSON.parse(data).token;
            console.log("Got token");
            
            const pOptions = {
                hostname: 'localhost',
                port: 5001,
                path: '/api/payments',
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }
            };
            const pReq = http.request(pOptions, pRes => {
                let pData = '';
                pRes.on('data', chunk => pData += chunk);
                pRes.on('end', async () => {
                    console.log("Payment response:", pRes.statusCode, pData);
                    await c.end();
                });
            });
            pReq.write(JSON.stringify(body));
            pReq.end();
        });
    });
    req.write(JSON.stringify({username: 'admin', password: 'admin'}));
    req.end();
}
run().catch(console.error);
