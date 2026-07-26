const fs = require('fs');
const file = 'server.js';
let content = fs.readFileSync(file, 'utf8');

const newRoute = `
// COMPLETE CUSTOMER WORKFLOW
app.post('/api/quotations/:id/complete-customer', requireAuth, uploadMem.any(), async (req, res) => {
  try {
    console.log('Complete customer workflow started for quotation', req.params.id);
    const quotationId = req.params.id;
    let { customerId, mobile, email, customerInfo } = req.body;
    
    let parsedCustomerInfo = {};
    try { if (customerInfo) parsedCustomerInfo = typeof customerInfo === 'string' ? JSON.parse(customerInfo) : customerInfo; } catch(e) {}

    const uploadedBy = (req.user && req.user.username) || 'system';

    // 1. Create or Update Customer
    let customerRecord = null;
    let isNewCustomer = false;
    
    if (customerId && customerId !== 'undefined' && customerId !== 'null' && customerId !== '') {
        // Update
        customerRecord = await updateEntity('customers', customerId, {
            mobile: mobile,
            email: email,
            customerInfo: parsedCustomerInfo
        });
    } else {
        // Create
        isNewCustomer = true;
        customerRecord = await supa.createCustomer({
            name: parsedCustomerInfo.ebName || 'New Customer',
            mobile: mobile,
            email: email,
            customerInfo: parsedCustomerInfo,
            status: 'Active'
        });
        customerId = customerRecord.id;
    }
    
    if (!customerRecord) {
        return res.status(500).json({ error: 'Unable to save customer information. Please try again.' });
    }

    // 2. Process Files
    const uploadedDocs = {};
    
    if (req.files && req.files.length > 0 && SupabaseStorageService.isStorageConfigured() && supa) {
        const customerCode = customerRecord.customer_code || \`CUST-\${customerId}\`;
        
        for (const file of req.files) {
            const documentType = file.fieldname; // 'pan', 'aadhaar', 'eb_receipt' etc.
            const subfolder = SupabaseStorageService.getSubfolderForDocumentType(documentType);
            const fileName = \`\${documentType.toUpperCase()}_\${Date.now()}_\${file.originalname.replace(/\\s+/g, '_')}\`;
            const filePath = \`\${customerCode}/\${subfolder}/\${fileName}\`;
            
            try {
                // Upload to Storage
                const uploaded = await SupabaseStorageService.uploadFile({
                    buffer: file.buffer,
                    path: filePath,
                    mimeType: file.mimetype,
                });
                
                // Save Metadata
                const docRecord = await supa.createDocumentRecord({
                    customer_id: customerId,
                    document_type: documentType,
                    file_name: fileName,
                    storage_path: uploaded.path,
                    mime_type: file.mimetype,
                    uploaded_by: uploadedBy
                });
                
                if (docRecord) {
                    uploadedDocs[documentType] = {
                        id: docRecord.id,
                        name: docRecord.file_name,
                        url: uploaded.publicUrl || \`/api/documents/download/\${docRecord.id}\`,
                        type: docRecord.mime_type,
                        uploadedAt: docRecord.uploaded_at
                    };
                }
            } catch (err) {
                console.error(\`Failed to upload \${documentType}:\`, err);
                // Continue with other files even if one fails
            }
        }
    }
    
    // Merge new docs into existing customer docs if updating
    let finalDocs = uploadedDocs;
    if (!isNewCustomer && customerRecord.documents) {
        finalDocs = { ...customerRecord.documents, ...uploadedDocs };
        await updateEntity('customers', customerId, { documents: finalDocs });
    } else {
        await updateEntity('customers', customerId, { documents: finalDocs });
    }

    // 3. Link to Quotation
    if (quotationId && quotationId !== 'undefined' && quotationId !== 'null' && quotationId !== '') {
        try {
            await updateEntity('quotations', quotationId, { customer_id: customerId });
        } catch (e) {
            console.error('Failed to link quotation to customer:', e);
        }
    }

    res.json({
        success: true,
        customer: {
            ...customerRecord,
            documents: finalDocs
        }
    });

  } catch (e) { 
      console.error("500 ERROR CAUGHT:", e); 
      require("fs").appendFileSync("server_errors.log", String(e.stack) + "\\n"); 
      res.status(500).json({ error: e.message }); 
  }
});

`;

content = content.replace("app.put('/api/quotations/:id', requireAuth, async (req, res) => {", newRoute + "app.put('/api/quotations/:id', requireAuth, async (req, res) => {");

fs.writeFileSync(file, content);
console.log("Backend patched");
