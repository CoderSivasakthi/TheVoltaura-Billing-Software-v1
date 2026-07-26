import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();

const pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://postgres.oybaxcchjmdxmspsqydv:TVABILL%400603@aws-0-ap-south-1.pooler.supabase.com:6543/postgres'
});

async function run() {
    try {
        const client = await pool.connect();
        
        await client.query(`
            CREATE TABLE IF NOT EXISTS settings (
                id TEXT PRIMARY KEY,
                global_settings JSONB DEFAULT '{}'
            );
            
            INSERT INTO settings (id, global_settings) 
            VALUES (
                'global', 
                '{"invoicePrefix": "INV/TVA/202627", "invoiceCounter": 1, "invoicePadding": 3, "quotationPrefix": "QT/TVA/202627", "quotationCounter": 1, "quotationPadding": 3}'
            ) ON CONFLICT DO NOTHING;
        `);
        console.log("Settings table created and seeded.");
        
        client.release();
    } catch (e) {
        console.error(e);
    } finally {
        pool.end();
    }
}
run();
