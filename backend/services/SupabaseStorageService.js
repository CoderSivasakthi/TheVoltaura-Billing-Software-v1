'use strict';

const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_KEY;
const BUCKET_NAME = process.env.SUPABASE_BUCKET_NAME || 'erp-documents';

let supabase = null;
if (SUPABASE_URL && SUPABASE_KEY) {
  supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: { persistSession: false },
  });
}

function isStorageConfigured() {
  return !!supabase;
}

// ── Build tenant-isolated path for franchise document storage ─────────────────
// New path structure:
//   erp-documents/Franchises/FR-0001/Customers/CUST-000001/Quotations/file.pdf
//   erp-documents/_health_checks/test.txt  (system unchanged)
function buildFranchisePath(franchiseId, customerCode, subfolder, fileName) {
  if (franchiseId && franchiseId !== 'admin') {
    // Normalise franchise ID to folder-safe name (TVA-FR-0001 → FR-0001)
    const frFolder = franchiseId.replace(/^TVA-/i, '');
    const parts = ['Franchises', frFolder];
    if (customerCode) parts.push('Customers', customerCode);
    if (subfolder)    parts.push(subfolder);
    if (fileName)     parts.push(fileName);
    return parts.join('/');
  }
  // No franchise (Super Admin or legacy) — use flat path
  const parts = [];
  if (customerCode) parts.push('Customers', customerCode);
  if (subfolder)    parts.push(subfolder);
  if (fileName)     parts.push(fileName);
  return parts.join('/');
}

// Upload a file to a specific path in the bucket.
// Supports franchiseId for tenant-scoped storage.
async function uploadFile({ buffer, path, mimeType, franchiseId, customerCode, subfolder, fileName }) {
  if (!supabase) throw new Error('Supabase not configured');

  // Auto-build path if franchiseId / customerCode / subfolder are provided instead of path
  const storagePath = path || buildFranchisePath(franchiseId, customerCode, subfolder, fileName);
  if (!storagePath) throw new Error('Storage path is required');

  const { data, error } = await supabase.storage
    .from(BUCKET_NAME)
    .upload(storagePath, buffer, {
      contentType: mimeType,
      upsert: true,
    });

  if (error) {
    console.error('Supabase Storage Upload Error:', error);
    throw error;
  }

  // Get public URL
  const { data: publicUrlData } = supabase.storage
    .from(BUCKET_NAME)
    .getPublicUrl(storagePath);

  console.log(`\n=====================================================`);
  console.log(`📤 Uploaded to Supabase Bucket: '${BUCKET_NAME}'`);
  console.log(`📍 Path: ${storagePath}`);
  if (franchiseId) console.log(`🏢 Franchise: ${franchiseId}`);
  console.log(`🔗 Public URL: ${publicUrlData.publicUrl}`);
  console.log(`=====================================================\n`);

  return {
    path: data.path,
    url: publicUrlData.publicUrl,
  };
}

// Download a file (returns an ArrayBuffer)
async function downloadFile(path) {
  if (!supabase) throw new Error('Supabase not configured');

  const { data, error } = await supabase.storage
    .from(BUCKET_NAME)
    .download(path);

  if (error) throw error;
  
  // data is a Blob in the browser, but in Node with supabase-js it might be a Blob or ArrayBuffer
  // We'll convert it to an ArrayBuffer, then to a Buffer
  const arrayBuffer = await data.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  return {
    buffer,
    mimeType: data.type
  };
}

// Delete a file
async function deleteFile(path) {
  if (!supabase) return false;
  const { error } = await supabase.storage
    .from(BUCKET_NAME)
    .remove([path]);
  if (error) throw error;
  console.log(`🗑️  Deleted from Supabase Bucket: ${path}`);
  return true;
}

// Map document type to subfolder name
function getSubfolderForDocumentType(documentType) {
  const map = {
    pan:           'Documents',
    aadhaar:       'Documents',
    bank_passbook: 'Documents',
    eb_receipt:    'EB Documents',
    rooftop_gps:   'GPS Photos',
    house_front:   'Images',
    eb_meter:      'Images',
    contract:      'Contracts',
    installation:  'Installation',
    payment_proof: 'Payments',
    quotation_pdf: 'Quotations',
    invoice_pdf:   'Invoices',
    other:         'Documents',
  };
  return map[documentType] || 'Documents';
}

async function testConnection() {
  if (!supabase) return { ok: false, message: 'Supabase URL/Key missing' };
  try {
    const { data, error } = await supabase.storage.getBucket(BUCKET_NAME);
    if (error) {
      return { ok: false, message: `Bucket '${BUCKET_NAME}' error: ${error.message}` };
    }
    return { ok: true, message: `Connected to bucket '${BUCKET_NAME}'`, bucket: BUCKET_NAME };
  } catch (e) {
    return { ok: false, message: e.message };
  }
}

module.exports = {
  isStorageConfigured,
  uploadFile,
  downloadFile,
  deleteFile,
  getSubfolderForDocumentType,
  buildFranchisePath,
  testConnection,
  BUCKET_NAME,
};
