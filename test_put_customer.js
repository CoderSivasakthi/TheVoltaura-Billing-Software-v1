async function test() {
    const res = await fetch('http://localhost:5001/api/customers');
    const custs = await res.json();
    const cust = custs[0];
    
    console.log("Updating customer", cust.id);
    const putRes = await fetch(`http://localhost:5001/api/customers/${cust.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'x-demo-auth': 'demo-token-12345' },
        body: JSON.stringify({
            mobile: '9876543210',
            customerInfo: { test: 'worked' },
            documents: { doc1: 'yes' }
        })
    });
    
    console.log("Status:", putRes.status);
    console.log("Body:", await putRes.text());
}
test();
