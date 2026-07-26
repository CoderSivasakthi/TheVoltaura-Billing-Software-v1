const fs = require('fs');
const filePath = 'frontend/src/pages/Customers.tsx';
let content = fs.readFileSync(filePath, 'utf8');
content = content.replace(/,\s*selectCustomerStatus/g, '');
fs.writeFileSync(filePath, content);
