const fs = require('fs');
const path = './backend/repos/supabaseRepo.js';
let content = fs.readFileSync(path, 'utf8');

content = content.replace(/console\.error\(error\)/g, "console.error(error); require('fs').appendFileSync('server_errors.log', '\\nSUPABASE ERROR:\\n' + JSON.stringify(error) + '\\n');");

fs.writeFileSync(path, content);
console.log("Patched supabaseRepo.js");
