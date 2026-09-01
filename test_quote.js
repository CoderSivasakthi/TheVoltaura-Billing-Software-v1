const http = require('http');

const payload = JSON.stringify({
  username: 'admin',
  password: 'admin'
});

const req = http.request({
  hostname: '127.0.0.1',
  port: 5001,
  path: '/api/auth/login',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': payload.length
  }
}, res => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    const token = JSON.parse(data).token;
    console.log('Got token:', token ? 'YES' : 'NO');
    
    const qPayload = JSON.stringify({
      customerId: 'CUST-000001',
      items: [],
      subtotal: 0,
      grandTotal: 0
    });
    
    const qReq = http.request({
      hostname: '127.0.0.1',
      port: 5001,
      path: '/api/quotations',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        'Content-Length': qPayload.length
      }
    }, qRes => {
      let qData = '';
      qRes.on('data', chunk => qData += chunk);
      qRes.on('end', () => {
        console.log('Quotation response status:', qRes.statusCode);
        console.log('Quotation response body:', qData);
      });
    });
    qReq.write(qPayload);
    qReq.end();
  });
});
req.write(payload);
req.end();
