import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supa = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

async function run() {
    const payload = {
            companyBranchId: "branch1",
            companyGst: "gst",
            companyAddress: "addr",
            customerId: "cust1",
            customerName: "name",
            date: "2026-01-01",
            billingAddr: "addr",
            siteAddr: "addr",
            notes: "notes",
            discount: 0,
            status: "Quoted",
            items: [],
            subtotal: 0,
            totalTax: 0,
            grandTotal: 0,
            total: 0,
            customerInfo: {},
            documents: {},
            systemSizeKw: 0,
            dailyGeneration: 0,
            annualGeneration: 0,
            gstAmount: 0,
            subsidyAmount: 0,
            netCustomerCost: 0,
            applyMnreSubsidy: false,
            applySplitGst: false,
            projectType: "Residential",
            customerCategory: "Residential"
    };

    const { data, error } = await supa.from('quotations').insert([payload]).select().single();
    if (error) {
        console.error("SUPABASE ERROR:", error);
    } else {
        console.log("SUCCESS:", data);
        await supa.from('quotations').delete().eq('id', data.id);
    }
}
run();
