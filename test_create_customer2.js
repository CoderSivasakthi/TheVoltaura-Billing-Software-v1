require('dotenv').config();
const repo = require('./backend/repos/supabaseRepo');
async function test() {
  const payload = {
    customerType: "Individual",
    name: "asdfasdf",
    companyName: "",
    email: "asdf@f.f",
    phone: "12312312",
    mobile: "",
    address: "",
    city: "",
    state: "",
    pincode: "",
    gstin: "",
    pan: "",
    aadhaar: "",
    tenant_id: 'test_tenant',
    franchise_id: 'TVA-FR-0003'
  };
  const c = await repo.createCustomer(payload);
  console.log(c);
}
test();
