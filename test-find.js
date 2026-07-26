require('dotenv').config();
const { findEntity } = require('./backend/repos/supabaseRepo');
async function check() {
  const q = await findEntity('quotations', 'QTVA2026270005');
  console.log(q);
}
check();
