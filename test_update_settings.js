import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supa = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

async function run() {
    const payload = { test: 1 };
    const { data, error } = await supa
        .from('company_settings')
        .update({ global_settings: payload })
        .eq('id', 'global')
        .select()
        .single();
        
    if (error) console.error("UPDATE ERROR:", error);
    else console.log("UPDATE SUCCESS:", data);
}
run();
