const repo = require('../backend/repos/supabaseRepo');

const products = [
    {
        name: 'Vikram Bifacial DCR Half Cut Solar Panel – 550 Wp',
        category: 'Solar Panel',
        brand: 'Vikram Solar',
        modelNumber: 'PARADEA VSMDH.72.550.05-30 DCR',
        hsnCode: '85414011',
        unit: 'Nos',
        gstRate: 5,
        netPrice: 13320,
        sellingPrice: 13475,
        price: 13475, // legacy field
        productType: 'Stock Item',
        stock: 0,
        minStock: 10,
        technicalSpecification: '550 Wp\nDCR\nBifacial\nHalf Cut\n144 Cells\nTopCon\n24V',
        productStatus: 'Active'
    },
    {
        name: 'Premier Energies DCR Solar Panel – 550 Wp',
        category: 'Solar Panel',
        brand: 'Premier Energies',
        modelNumber: 'PE-DCR-550Wp-BiF-PERC-PT-G2TS',
        hsnCode: '85414300',
        unit: 'Nos',
        gstRate: 5,
        netPrice: 12870,
        sellingPrice: 13513.50,
        price: 13513.50,
        productType: 'Stock Item',
        stock: 0,
        minStock: 10,
        technicalSpecification: '550 Wp\nDCR\nBifacial\nPERC\n144 Cells',
        productStatus: 'Active'
    },
    {
        name: 'Deye 5 kW Single Phase On-Grid Inverter',
        category: 'On-Grid Inverter',
        brand: 'Deye',
        modelNumber: '5 kW 1 PH On-Grid',
        hsnCode: '85414011',
        unit: 'Nos',
        gstRate: 5,
        netPrice: 43800,
        sellingPrice: 50000, // Using 50000 as default editable
        price: 50000,
        productType: 'Stock Item',
        stock: 0,
        minStock: 5,
        technicalSpecification: 'Single Phase\n1 MPPT\n1 String',
        productStatus: 'Active'
    },
    {
        name: 'Deye 8 kW Three Phase On-Grid Inverter',
        category: 'On-Grid Inverter',
        brand: 'Deye',
        modelNumber: 'SUN-8K-G03',
        hsnCode: '85414011',
        unit: 'Nos',
        gstRate: 5,
        netPrice: 43800,
        sellingPrice: 55000,
        price: 55000,
        productType: 'Stock Item',
        stock: 0,
        minStock: 5,
        technicalSpecification: 'Three Phase\n2 MPPT\n1 String',
        productStatus: 'Active'
    },
    {
        name: 'Deye 5 kW Hybrid Inverter',
        category: 'Hybrid Inverter',
        brand: 'Deye',
        modelNumber: '5 kW 48V Single Phase LV Hybrid',
        hsnCode: '85414011',
        unit: 'Nos',
        gstRate: 5,
        netPrice: 76460,
        sellingPrice: 85000,
        price: 85000,
        productType: 'Stock Item',
        stock: 0,
        minStock: 5,
        technicalSpecification: '48V\n2 MPPT\n1 String\nSingle Phase',
        productStatus: 'Active'
    },
    {
        name: 'Deye LFP SE-5 Plus Battery',
        category: 'Battery',
        brand: 'Deye',
        modelNumber: 'SE-5 Plus',
        unit: 'Nos',
        gstRate: 18,
        netPrice: 83490,
        sellingPrice: 90000,
        price: 90000,
        productType: 'Stock Item',
        stock: 0,
        minStock: 5,
        technicalSpecification: 'Lithium Iron Phosphate\n6000 Cycles\n10 Years Warranty',
        productStatus: 'Active'
    },
    {
        name: 'Battery Box with DCDB',
        category: 'Battery Box',
        unit: 'Nos',
        gstRate: 18,
        netPrice: 5260,
        sellingPrice: 6500,
        price: 6500,
        productType: 'Stock Item',
        stock: 0,
        minStock: 5,
        productStatus: 'Active'
    },
    {
        name: 'DCDB (1–5 kW)',
        category: 'DCDB',
        hsnCode: '85437092',
        unit: 'Nos',
        gstRate: 18,
        netPrice: 1400,
        sellingPrice: 5400,
        price: 5400,
        productType: 'Stock Item',
        stock: 0,
        minStock: 5,
        technicalSpecification: '1 In\n1 Out\n500V\nMCB\nSPD',
        productStatus: 'Active'
    },
    {
        name: 'DCDB (5–8 kW)',
        category: 'DCDB',
        hsnCode: '85437092',
        unit: 'Nos',
        gstRate: 18,
        netPrice: 2900,
        sellingPrice: 6000,
        price: 6000,
        productType: 'Stock Item',
        stock: 0,
        minStock: 5,
        technicalSpecification: '2 In\n2 Out\n500V\n2 MCB\n2 SPD',
        productStatus: 'Active'
    },
    {
        name: 'DCDB (Hybrid 5 kW)',
        category: 'DCDB',
        unit: 'Nos',
        gstRate: 18,
        netPrice: 5100,
        sellingPrice: 8000,
        price: 8000,
        productType: 'Stock Item',
        stock: 0,
        minStock: 5,
        technicalSpecification: '2 In\n2 Out\n500V\n2 MCB\n2 SPD',
        productStatus: 'Active'
    },
    {
        name: 'ACDB (1–5 kW)',
        category: 'ACDB',
        hsnCode: '85437092',
        unit: 'Nos',
        gstRate: 18,
        netPrice: 1250,
        sellingPrice: 4000,
        price: 4000,
        productType: 'Stock Item',
        stock: 0,
        minStock: 5,
        technicalSpecification: 'Single Phase\n32A\nSPD',
        productStatus: 'Active'
    },
    {
        name: 'ACDB (5–8 kW)',
        category: 'ACDB',
        unit: 'Nos',
        gstRate: 18,
        netPrice: 2900,
        sellingPrice: 5000,
        price: 5000,
        productType: 'Stock Item',
        stock: 0,
        minStock: 5,
        technicalSpecification: 'Three Phase\n32A',
        productStatus: 'Active'
    },
    {
        name: 'ACDB (Hybrid 5 kW)',
        category: 'ACDB',
        unit: 'Nos',
        gstRate: 18,
        netPrice: 4950,
        sellingPrice: 7000,
        price: 7000,
        productType: 'Stock Item',
        stock: 0,
        minStock: 5,
        technicalSpecification: 'Single Phase\n32A\nChange Over',
        productStatus: 'Active'
    },
    {
        name: 'Excel Lightning Arrester',
        category: 'Lightning Arrester',
        unit: 'Nos',
        gstRate: 18,
        netPrice: 1200,
        sellingPrice: 2500,
        price: 2500,
        productType: 'Stock Item',
        stock: 0,
        minStock: 5,
        technicalSpecification: '20 mm\n1 Meter\n100 Microns',
        productStatus: 'Active'
    },
    {
        name: 'Excel Earthing Rod',
        category: 'Earthing Rod',
        unit: 'Nos',
        gstRate: 18,
        netPrice: 465,
        sellingPrice: 900,
        price: 900,
        productType: 'Stock Item',
        stock: 0,
        minStock: 5,
        technicalSpecification: '17.2 mm\n1.2 Meter\n100 Microns',
        productStatus: 'Active'
    },
    {
        name: 'Earthing Chemical Bag',
        category: 'Earthing Chemical',
        unit: 'Bag',
        gstRate: 18,
        netPrice: 230,
        sellingPrice: 450,
        price: 450,
        productType: 'Stock Item',
        stock: 0,
        minStock: 10,
        technicalSpecification: '10 Kg',
        productStatus: 'Active'
    }
];

async function seedProducts() {
    console.log('Seeding products...');
    let successCount = 0;
    
    for (const p of products) {
        try {
            // Generate SKU based on name words
            const sku = p.name.split(' ').map(w => w[0]).join('').toUpperCase() + '-' + Math.floor(Math.random() * 1000);
            p.sku = sku;
            await repo.create('products', p);
            console.log(`Created product: ${p.name}`);
            successCount++;
        } catch (err) {
            console.error(`Failed to create product ${p.name}:`, err.message);
        }
    }
    
    console.log(`Successfully seeded ${successCount} out of ${products.length} products.`);
    process.exit(0);
}

seedProducts();
