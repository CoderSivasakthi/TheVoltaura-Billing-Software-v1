import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supa = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

async function run() {
    const qPayload = {
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

    const qRes = await supa.from('quotations').insert([qPayload]).select().single();
    if (qRes.error) {
        console.error("QUOTATION ERROR:", qRes.error);
    } else {
        console.log("QUOTATION SUCCESS:", qRes.data);
        await supa.from('quotations').delete().eq('id', qRes.data.id);
    }
    
    const iPayload = {
            customerId: "cust1",
            customerName: "name",
            date: "2026-01-01",
            dueDate: "2026-02-01",
            supplyType: "Supply",
            status: "Pending",
            appRegNo: "123",
            appSanctionNo: "123",
            tangedcoNo: "123",
            dispatchedThrough: "Truck",
            lrRrNo: "123",
            items: [],
            subtotal: 0,
            totalTax: 0,
            gst: 0,
            discount: 0,
            grandTotal: 0,
            total: 0
    };
    
    const iRes = await supa.from('invoices').insert([iPayload]).select().single();
    if (iRes.error) {
        console.error("INVOICE ERROR:", iRes.error);
    } else {
        console.log("INVOICE SUCCESS:", iRes.data);
        await supa.from('invoices').delete().eq('id', iRes.data.id);
    }
}
run();
