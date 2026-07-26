const http = require('http');

async function run() {
    const payload = JSON.stringify({
        orgName: "Test Org",
        email: "test@example.com",
        phone: "1234567890",
        invPrefix: "INV",
        quotPrefix: "QT",
        gstRate: "18",
        logo: "logo.png",
        branches: [],
        hsnCodes: [],
        taxRates: [],
        lowStock: true,
        overdueAlert: true,
        amcAlert: true
    });
    
    const options = {
        hostname: 'localhost',
        port: 5001,
        path: '/api/settings',
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json',
            'authorization': 'Bearer demo-token-12345',
            'Content-Length': Buffer.byteLength(payload)
        }
    };
    
    const req = http.request(options, (res) => {
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => {
            console.log("STATUS:", res.statusCode, "RESPONSE:", data);
        });
    });
    
    req.on('error', (e) => {
        console.error(`Problem with request: ${e.message}`);
    });
    
    req.write(payload);
    req.end();
}
run();
