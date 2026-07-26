require('dotenv').config();
const { Client } = require('pg');

async function migrate() {
    const client = new Client({ connectionString: process.env.DATABASE_URL });
    await client.connect();
    
    console.log("Adding multi-tenant columns...");
    
    const tables = ['users', 'customers', 'products', 'quotations', 'quotation_items', 'invoices', 'payments', 'orders'];
    for (const table of tables) {
        try {
            await client.query(`ALTER TABLE ${table} ADD COLUMN IF NOT EXISTS tenant_id TEXT DEFAULT 'admin';`);
            await client.query(`ALTER TABLE ${table} ADD COLUMN IF NOT EXISTS franchise_id TEXT;`);
            console.log(`Added columns to ${table}`);
        } catch (e) {
            console.warn(`Could not add to ${table}:`, e.message);
        }
    }
    
    console.log("Updating payments constraint chk_payment_status...");
    try {
        await client.query(`ALTER TABLE payments DROP CONSTRAINT IF EXISTS chk_payment_status;`);
        await client.query(`ALTER TABLE payments ADD CONSTRAINT chk_payment_status CHECK (status IN ('Pending', 'Confirmed', 'Failed', 'Refunded', 'Paid', 'Partially Paid', 'Unpaid'));`);
        console.log("Updated chk_payment_status");
    } catch (e) {
        console.error("Failed to update chk_payment_status:", e.message);
    }
    
    console.log("Updating orders constraint chk_order_priority...");
    try {
        await client.query(`ALTER TABLE orders DROP CONSTRAINT IF EXISTS chk_order_priority;`);
        await client.query(`ALTER TABLE orders ADD CONSTRAINT chk_order_priority CHECK (priority IN ('Low', 'Normal', 'Medium', 'High', 'Urgent'));`);
        console.log("Updated chk_order_priority");
    } catch (e) {
        console.error("Failed to update chk_order_priority:", e.message);
    }
    
    await client.end();
    console.log("Migration complete!");
}

migrate().catch(e => {
    console.error("Migration failed:", e);
    process.exit(1);
});
