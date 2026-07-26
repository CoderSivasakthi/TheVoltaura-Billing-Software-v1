const payload = {
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
require('child_process').execSync(`curl -X PUT http://localhost:5001/api/quotations/QTVA2026270003 -H "Content-Type: application/json" -H "x-demo-auth: demo-token-12345" -d '${JSON.stringify(payload)}'`);
