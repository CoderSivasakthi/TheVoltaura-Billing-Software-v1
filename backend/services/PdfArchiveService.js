// ═══════════════════════════════════════════════════════════════════════
// PdfArchiveService.js
// Auto-archives generated PDFs (quotations, invoices) to Supabase Storage
// with version control (v1, v2, v3...)
// ═══════════════════════════════════════════════════════════════════════
'use strict';

const storageService = require('./SupabaseStorageService');
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_KEY;

let _supa = null;
function getSupa() {
  if (!_supa) {
    _supa = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
  }
  return _supa;
}

// ═══════════════════════════════════════════════════════════════════════
// Archive a Quotation PDF
// ═══════════════════════════════════════════════════════════════════════
async function archiveQuotationPdf({ quotationId, customerId, customerCode, pdfBuffer, generatedBy }) {
  if (!storageService.isStorageConfigured()) {
    console.warn('⚠️  Storage not configured — skipping PDF archive for quotation', quotationId);
    return null;
  }

  try {
    const supa = getSupa();

    // Determine version number
    const { data: existing } = await supa
      .from('quotation_documents')
      .select('version_number')
      .eq('quotation_id', quotationId)
      .order('version_number', { ascending: false })
      .limit(1);

    const versionNumber = existing && existing.length > 0 ? existing[0].version_number + 1 : 1;
    const fileName = `${quotationId}_v${versionNumber}.pdf`;

    // Folder structure in Supabase: customer_code/Quotations/filename
    const folderName = customerCode || `CUST-${customerId}`;
    const filePath = `${folderName}/Quotations/${fileName}`;

    // Upload to Supabase Storage
    const uploaded = await storageService.uploadFile({
      buffer: pdfBuffer,
      path: filePath,
      mimeType: 'application/pdf',
    });

    // Mark previous versions as not latest
    await supa
      .from('quotation_documents')
      .update({ is_latest: false })
      .eq('quotation_id', quotationId);

    // Save metadata to Supabase
    const { data: doc } = await supa
      .from('quotation_documents')
      .insert({
        quotation_id:           quotationId,
        customer_id:            customerId,
        version_number:         versionNumber,
        file_name:              fileName,
        supabase_storage_path:  uploaded.path,
        file_url:               uploaded.url,
        file_size_bytes:        pdfBuffer.length,
        is_latest:              true,
        archived_by:            generatedBy || 'system',
      })
      .select()
      .single();

    // Update quotation with latest PDF version info
    await supa
      .from('quotations')
      .update({
        latest_pdf_storage_path: uploaded.path,
        pdf_version:         versionNumber,
      })
      .eq('id', quotationId);

    // Write audit log
    await supa.from('audit_logs').insert({
      action:               'upload',
      entity_type:          'quotation_pdf',
      entity_id:            quotationId,
      customer_id:          customerId,
      document_type:        'quotation_pdf',
      supabase_storage_path: uploaded.path,
      file_name:            fileName,
      performed_by:         generatedBy || 'system',
      metadata:             { version: versionNumber, url: uploaded.url },
    });

    return { path: uploaded.path, fileName, version: versionNumber, viewLink: uploaded.url };
  } catch (e) {
    console.error('❌ Failed to archive quotation PDF:', e.message);
    return null; // Don't fail the main request if archiving fails
  }
}

// ═══════════════════════════════════════════════════════════════════════
// Archive an Invoice PDF
// ═══════════════════════════════════════════════════════════════════════
async function archiveInvoicePdf({ invoiceId, customerId, customerCode, pdfBuffer, generatedBy }) {
  if (!storageService.isStorageConfigured()) {
    console.warn('⚠️  Storage not configured — skipping PDF archive for invoice', invoiceId);
    return null;
  }

  try {
    const supa = getSupa();

    const { data: existing } = await supa
      .from('invoice_documents')
      .select('version_number')
      .eq('invoice_id', invoiceId)
      .order('version_number', { ascending: false })
      .limit(1);

    const versionNumber = existing && existing.length > 0 ? existing[0].version_number + 1 : 1;
    const fileName = `${invoiceId}_v${versionNumber}.pdf`;

    const folderName = customerCode || `CUST-${customerId}`;
    const filePath = `${folderName}/Invoices/${fileName}`;

    const uploaded = await storageService.uploadFile({
      buffer: pdfBuffer,
      path: filePath,
      mimeType: 'application/pdf',
    });

    await supa
      .from('invoice_documents')
      .update({ is_latest: false })
      .eq('invoice_id', invoiceId);

    const { data: doc } = await supa
      .from('invoice_documents')
      .insert({
        invoice_id:             invoiceId,
        customer_id:            customerId,
        version_number:         versionNumber,
        file_name:              fileName,
        supabase_storage_path:  uploaded.path,
        file_url:               uploaded.url,
        file_size_bytes:        pdfBuffer.length,
        is_latest:              true,
        archived_by:            generatedBy || 'system',
      })
      .select()
      .single();

    await supa
      .from('invoices')
      .update({ latest_pdf_storage_path: uploaded.path, pdf_version: versionNumber })
      .eq('id', invoiceId);

    await supa.from('audit_logs').insert({
      action:               'upload',
      entity_type:          'invoice_pdf',
      entity_id:            invoiceId,
      customer_id:          customerId,
      supabase_storage_path: uploaded.path,
      file_name:            fileName,
      performed_by:         generatedBy || 'system',
      metadata:             { version: versionNumber, url: uploaded.url },
    });

    return { path: uploaded.path, fileName, version: versionNumber, viewLink: uploaded.url };
  } catch (e) {
    console.error('❌ Failed to archive invoice PDF:', e.message);
    return null;
  }
}

module.exports = { archiveQuotationPdf, archiveInvoicePdf };
