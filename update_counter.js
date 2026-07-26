import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();

const pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL
});

async function run() {
    try {
        const client = await pool.connect();
        
        // Fetch current global_settings
        const res = await client.query(`SELECT global_settings FROM company_settings WHERE id = 'global';`);
        const gs = res.rows[0].global_settings;
        
        // Update the counters to be higher than existing documents
        if (gs.quotationCounter) {
            gs.quotationCounter = 2026270003; // Next ID will be QTVA2026270003
        }
        if (gs.invoiceCounter) {
            gs.invoiceCounter = 2026270003; 
        }
        
        // Update DB
        await client.query(`UPDATE company_settings SET global_settings = $1 WHERE id = 'global';`, [gs]);
        console.log("Global settings counters updated successfully.");
        
        client.release();
    } catch (e) {
        console.error(e);
    } finally {
        pool.end();
    }
}
run();
