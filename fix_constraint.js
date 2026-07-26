require('dotenv').config();
const { Client } = require('pg');

async function run() {
    const c = new Client({connectionString: process.env.DATABASE_URL});
    await c.connect();
    await c.query("ALTER TABLE orders DROP CONSTRAINT IF EXISTS chk_order_status");
    await c.query("ALTER TABLE orders ADD CONSTRAINT chk_order_status CHECK (order_status IN ('Pending', 'Priority Orders', 'Material Procurement', 'Installation Scheduled', 'Installation In Progress', 'Commissioned', 'Completed', 'Cancelled', 'On Hold', 'In Progress'))");
    console.log("chk_order_status updated");
    await c.end();
}
run().catch(console.error);
