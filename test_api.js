const jwt = require('jsonwebtoken');
require('dotenv').config();
const token = jwt.sign({ username: 'admin', role: 'admin' }, process.env.JWT_SECRET || 'dev_secret_key', { expiresIn: '8h' });
async function run() {
  const res = await fetch('http://localhost:5001/api/approvals/pending', {
    headers: { 'Authorization': 'Bearer ' + token }
  });
  console.log(res.status, await res.text());
}
run();
