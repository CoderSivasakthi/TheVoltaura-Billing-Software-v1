const fs = require('fs');
const path = require('path');

// Helper to construct multipart form data exactly as the frontend would via FormData
async function runE2ETest() {
    try {
        console.log("=== STARTING E2E TEST: COMPLETE NOW WORKFLOW ===");
        
        // 1. Get auth token
        const login = await fetch('http://localhost:5001/api/auth/login', {
            method: 'POST', headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({username: 'admin', password: 'admin'})
        });
        const token = (await login.json()).token;
        if (!token) throw new Error("Failed to login");
        console.log("✓ Logged in, token retrieved");

        // 2. Fetch customers to grab one, or we can just send empty customerId to create one!
        // We will simulate CREATING a new customer just to prove it fully works end-to-end.
        
        console.log("✓ Simulating Frontend form data assembly...");
        
        const customerInfo = {
            consumerNumber: 'EB123456',
            ebName: 'John Doe Testing',
            ebMobile: '9998887776',
            paymentMode: 'Loan',
            loanFinanceCompany: 'HDFC',
            loanAmount: '500000',
            loanStatus: 'Approved'
        };

        // We will construct a real multipart/form-data payload manually
        // We'll create a tiny dummy PDF file to upload
        const dummyPdfPath = path.join(__dirname, 'dummy_test.pdf');
        fs.writeFileSync(dummyPdfPath, '%PDF-1.4\n%Dummy PDF for testing Complete Now\n');
        
        const boundary = '----WebKitFormBoundary7MA4YWxkTrZu0gW';
        let body = '';
        
        // Helper to append field
        const appendField = (name, value) => {
            body += `--${boundary}\r\n`;
            body += `Content-Disposition: form-data; name="${name}"\r\n\r\n`;
            body += `${value}\r\n`;
        };
        
        appendField('mobile', '9876500001');
        appendField('email', 'johndoe@example.com');
        appendField('customerInfo', JSON.stringify(customerInfo));
        
        // Helper to append file
        const appendFile = (fieldName, filePath, fileName) => {
            const content = fs.readFileSync(filePath);
            body += `--${boundary}\r\n`;
            body += `Content-Disposition: form-data; name="${fieldName}"; filename="${fileName}"\r\n`;
            body += `Content-Type: application/pdf\r\n\r\n`;
            body += content.toString('binary') + '\r\n'; // basic binary stringification
        };
        
        appendFile('pan', dummyPdfPath, 'John_Doe_PAN.pdf');
        appendFile('eb_receipt', dummyPdfPath, 'John_Doe_EB.pdf');
        
        body += `--${boundary}--\r\n`;
        
        console.log("✓ POSTing to /api/quotations/new/complete-customer");
        const res = await fetch(`http://localhost:5001/api/quotations/new/complete-customer`, {
            method: 'POST',
            headers: {
                'x-demo-auth': token,
                'Content-Type': `multipart/form-data; boundary=${boundary}`
            },
            body: Buffer.from(body, 'binary')
        });
        
        const text = await res.text();
        let data;
        try { data = JSON.parse(text); } catch(e) { throw new Error("Invalid JSON: " + text); }
        
        if (!res.ok) {
            console.error("X Backend returned error:", data);
            throw new Error("Backend error");
        }
        
        console.log("✓ Response Success:", data.success);
        console.log("✓ Customer Created/Updated. ID:", data.customer.id);
        console.log("✓ Documents Uploaded:", Object.keys(data.customer.documents || {}));
        
        const panDoc = data.customer.documents['pan'];
        if (panDoc && panDoc.url) {
            console.log("✓ PAN Document URL generated successfully");
            console.log("  URL:", panDoc.url);
        } else {
            throw new Error("PAN Document was not uploaded or returned correctly");
        }
        
        console.log("=== ALL E2E TESTS PASSED SUCCESSFULLY ===");
        
    } catch (e) {
        console.error("E2E TEST FAILED:", e);
    }
}
runE2ETest();
