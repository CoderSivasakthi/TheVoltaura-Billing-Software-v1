require('dotenv').config();
const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_KEY;

async function check() {
    try {
        const resp = await fetch(`${SUPABASE_URL}/rest/v1/customers?select=id&limit=1`, {
            headers: {
                'apikey': SERVICE_ROLE_KEY,
                'Authorization': `Bearer ${SERVICE_ROLE_KEY}`
            }
        });
        console.log('Status:', resp.status);
        console.log('Headers:');
        for (let [key, value] of resp.headers.entries()) {
            console.log(`  ${key}: ${value}`);
        }
        if (resp.ok) {
            const data = await resp.json();
            console.log('Success! Data:', data);
        } else {
            const text = await resp.text();
            console.log('Error:', text);
        }
    } catch (e) {
        console.error('Fetch failed:', e.message);
    }
}

check();
