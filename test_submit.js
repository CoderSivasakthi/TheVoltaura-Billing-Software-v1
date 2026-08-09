const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();
const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET || 'dev_secret_key';

// Mock token for franchise
const tokenPayload = { 
    username: 'civilgire@gmail.com', 
    role: 'franchise_admin',
    tenant_id: 'TVA-FR-0003', 
    franchise_id: 'TVA-FR-0003',
};
const token = jwt.sign(tokenPayload, JWT_SECRET, { expiresIn: '8h' });

async function run() {
    const res = await fetch('http://localhost:5001/api/quotations', {
        headers: { 'Authorization': 'Bearer ' + token }
    });
    const qs = await res.json();
    if (!qs || qs.length === 0) return;
    
    // Pick the first one belonging to TVA-FR-0003
    const myQ = qs.find(q => q.franchise_id === 'TVA-FR-0003');
    if (!myQ) {
      console.log('No quotation found for TVA-FR-0003');
      return;
    }
    console.log('Submitting:', encodeURIComponent(myQ.id));
    const submitRes = await fetch('http://localhost:5001/api/quotations/' + encodeURIComponent(myQ.id) + '/submit', {
        method: 'POST',
        headers: { 'Authorization': 'Bearer ' + token }
    });
    console.log(submitRes.status, await submitRes.text());
}
run();
