const fs = require('fs');
const path = './server.js';
let content = fs.readFileSync(path, 'utf8');

const target = "const upd = await updateEntity('quotations', req.params.id, req.body);";
const replacement = "console.log('PUT /api/quotations/:id', req.params.id, JSON.stringify(req.body).slice(0, 500));\n    const upd = await updateEntity('quotations', req.params.id, req.body);";

content = content.replace(target, replacement);

fs.writeFileSync(path, content);
console.log("Patched server.js");
