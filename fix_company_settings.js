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
            ALTER TABLE company_settings ADD COLUMN IF NOT EXISTS global_settings JSONB DEFAULT '{}';
            
            UPDATE company_settings 
            SET global_settings = '{"invoicePrefix": "INV/TVA/202627", "invoiceCounter": 1, "invoicePadding": 3, "quotationPrefix": "QT/TVA/202627", "quotationCounter": 1, "quotationPadding": 3}'
            WHERE id = 'global';
            
            -- If 'global' didn't exist for some reason, insert it
            INSERT INTO company_settings (id, company_name, global_settings) 
            VALUES (
                'global', 
                'TheVoltaura Solar',
                '{"invoicePrefix": "INV/TVA/202627", "invoiceCounter": 1, "invoicePadding": 3, "quotationPrefix": "QT/TVA/202627", "quotationCounter": 1, "quotationPadding": 3}'
            ) ON CONFLICT (id) DO NOTHING;
        `);
        console.log("company_settings table successfully patched with global_settings.");
        
        client.release();
    } catch (e) {
        console.error(e);
    } finally {
        pool.end();
    }
}
run();
