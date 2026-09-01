// Load .env (SUPABASE_URL, SUPABASE_KEY, PORT, etc.)
require('dotenv').config();

process.on('unhandledRejection', (err) => {
  console.error('[unhandledRejection]', err);
});

// Express-based static server + simple JSON file-backed mock API
const express = require('express');
const fs = require('fs');
const path = require('path');
const cors = require('cors');
const DocumentNumberService = require('./backend/services/DocumentNumberService');
const { resolveTenant, requireSuperAdmin, requireFranchiseAdmin, applyTenantFilter, tenantPayload, enforceSettingsLock } = require('./backend/middleware/tenantMiddleware');
const { requirePermission, getPermissionsForRole } = require('./backend/middleware/rbacMiddleware');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { Pool } = require('pg');
const http = require('http');
const multer = require('multer');

// ── Google Drive & PDF Archive Services ─────────────────────────────────────
const SupabaseStorageService = require('./backend/services/SupabaseStorageService');
const PdfArchiveService  = require('./backend/services/PdfArchiveService');

let wss = null; // WebSocket server will be attached to this

const PORT = process.env.PORT || 5001;
const app = express();
const DATA_DIR = path.join(__dirname, 'data');
const JWT_SECRET = process.env.JWT_SECRET || 'dev_secret_key';

// Optional Postgres connection (used when DOCKER_DB=true)
let dbPool = null;
if (process.env.DOCKER_DB === 'true') {
  dbPool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgres://postgres:postgres@db:5432/solarflow'
  });
}

const allowedOrigins = (process.env.CORS_ORIGINS || process.env.PUBLIC_APP_ORIGIN || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

app.use(cors({
  origin: (origin, cb) => {
    if (!origin) return cb(null, true);
    if (allowedOrigins.length === 0) return cb(null, true);
    if (allowedOrigins.includes(origin)) return cb(null, true);
    if (/^https:\/\/[\w-]+\.github\.io$/.test(origin)) return cb(null, true);
    return cb(null, false);
  },
  credentials: true,
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Serve static frontend from the React dist directory
app.use(express.static(path.join(__dirname, 'frontend/dist')));

// Serve uploaded documents statically
app.use('/uploads', express.static(path.join(__dirname, 'data/uploads')));

// ── Multer Configuration ─────────────────────────────────────────────────────
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(DATA_DIR, 'uploads');
    if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + '-' + file.originalname.replace(/\s+/g, '_'));
  }
});
const upload = multer({ 
  storage, 
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

// ── Multer (memory storage for Drive upload, disk for local fallback) ───────
const memStorage = multer.memoryStorage();
const uploadMem  = multer({ storage: memStorage, limits: { fileSize: 25 * 1024 * 1024 } }); // 25MB

// ── Drive-Backed File Upload Endpoint ───────────────────────────────────────
// POST /api/upload
// Fields: document (file), customerId, documentType, customerCode
// When Drive is configured: uploads to Drive + stores metadata in Supabase.
// When Drive is NOT configured: saves to local disk (dev fallback).
app.post('/api/upload', uploadMem.single('document'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

  const { customerId, documentType = 'other', customerCode } = req.body;
  const uploadedBy = (req.user && req.user.username) || 'system';
  const ip = req.ip || req.connection.remoteAddress;

  // ── Path A: Supabase Storage Upload ────────────────────────────────────
  if (SupabaseStorageService.isStorageConfigured() && customerId && supa) {
    try {
      // Resolve the correct Supabase folder for this document type
      const customer = await supa.find('customers', customerId);
      const subfolder = SupabaseStorageService.getSubfolderForDocumentType(documentType);
      
      const folderName = customerCode || `CUST-${customerId}`;
      const fileName = `${documentType.toUpperCase()}_${Date.now()}_${req.file.originalname.replace(/\s+/g, '_')}`;
      const filePath = `${folderName}/${subfolder}/${fileName}`;

      const uploaded = await SupabaseStorageService.uploadFile({
        buffer:   req.file.buffer,
        path:     filePath,
        mimeType: req.file.mimetype,
      });

      // Store metadata in Supabase
      let docRecord = null;
      if (customerId) {
        docRecord = await supa.createDocumentRecord({
          customer_id:            customerId,
          document_type:          documentType,
          file_name:              fileName,
          original_file_name:     req.file.originalname,
          mime_type:              req.file.mimetype,
          file_size_bytes:        req.file.size,
          supabase_storage_path:  uploaded.path,
          file_url:               uploaded.url,
          uploaded_by:            uploadedBy,
          uploaded_by_ip:         ip,
        });
      }

      // Write audit log
      await supa.writeAuditLog({
        action:               'upload',
        entity_type:          'customer_document',
        entity_id:            docRecord ? docRecord.id : null,
        customer_id:          customerId,
        document_type:        documentType,
        supabase_storage_path: uploaded.path,
        file_name:            fileName,
        performed_by:         uploadedBy,
        ip_address:           ip,
      });

      return res.json({
        ok:          true,
        storage:     'supabase_storage',
        documentId:  docRecord ? docRecord.id : null,
        fileId:      uploaded.path, // path acts as ID
        fileName:    fileName,
        viewLink:    uploaded.url,
        url:         uploaded.url,
        name:        req.file.originalname,
      });
    } catch (e) {
      console.error('Supabase Storage upload failed:', e.message);
      // Do NOT create a partial record — return error
      return res.status(500).json({ error: 'Failed to upload to Supabase Storage. Please try again.', detail: e.message });
    }
  }

  // ── Path B: Local Disk Fallback (when Drive not configured) ────────
  try {
    const uploadDir = path.join(DATA_DIR, 'uploads');
    if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const safeFilename = uniqueSuffix + '-' + req.file.originalname.replace(/\s+/g, '_');
    await fs.promises.writeFile(path.join(uploadDir, safeFilename), req.file.buffer);
    const fileUrl = `/uploads/${safeFilename}`;
    res.json({
      ok:      true,
      storage: 'local',
      url:     fileUrl,
      name:    req.file.originalname,
      filename: safeFilename,
    });
  } catch (e) {
    res.status(500).json({ error: 'Upload failed', detail: e.message });
  }
});

// ── Serve local uploads (fallback when Drive not configured) ──────────────────
app.use('/uploads', express.static(path.join(__dirname, 'data/uploads')));

// ── Secure Document Download Proxy ──────────────────────────────────────────
// GET /api/documents/download/:documentId
// Fetches from Supabase Storage and streams to client.
app.get('/api/documents/download/:documentId', async (req, res) => {
  try {
    if (!supa) return res.status(503).json({ error: 'Database not available' });

    const doc = await supa.getDocumentById(req.params.documentId);
    if (!doc) return res.status(404).json({ error: 'Document not found' });
    if (!doc.supabase_storage_path) return res.status(404).json({ error: 'No storage path linked to this document' });

    // Write audit log
    await supa.writeAuditLog({
      action:               'download',
      entity_type:          'customer_document',
      entity_id:            doc.id,
      customer_id:          doc.customer_id,
      document_type:        doc.document_type,
      supabase_storage_path: doc.supabase_storage_path,
      file_name:            doc.file_name,
      performed_by:         (req.user && req.user.username) || 'anonymous',
      ip_address:           req.ip,
    });

    const { buffer, mimeType } = await SupabaseStorageService.downloadFile(doc.supabase_storage_path);

    res.setHeader('Content-Disposition', `attachment; filename="${doc.original_file_name || doc.file_name}"`);
    res.setHeader('Content-Type', mimeType || doc.mime_type || 'application/octet-stream');
    res.send(buffer);
  } catch (e) {
    res.status(500).json({ error: 'Download failed', detail: e.message });
  }
});

// ── Get All Documents for a Customer ────────────────────────────────────────
app.get('/api/customers/:id/documents', async (req, res) => {
  try {
    if (!supa) return res.json([]);
    const docs = await supa.getCustomerDocuments(req.params.id);
    res.json(docs || []);
  } catch (e) { console.error("500 ERROR CAUGHT:", e); require("fs").appendFileSync("server_errors.log", String(e.stack) + "\n"); res.status(500).json({ error: e.message }); }
});

// ── Soft-Delete Document ─────────────────────────────────────────────────────
app.delete('/api/documents/:documentId', requireAuth, async (req, res) => {
  try {
    if (!supa) return res.status(503).json({ error: 'Database not available' });
    const doc = await supa.getDocumentById(req.params.documentId);
    if (!doc) return res.status(404).json({ error: 'Document not found' });

    const deletedBy = (req.user && req.user.username) || 'system';
    await supa.softDeleteDocument(req.params.documentId, deletedBy);

    // Optionally also delete from Supabase Storage
    if (doc.supabase_storage_path) await SupabaseStorageService.deleteFile(doc.supabase_storage_path);

    await supa.writeAuditLog({
      action: 'delete', entity_type: 'customer_document',
      entity_id: doc.id, customer_id: doc.customer_id,
      supabase_storage_path: doc.supabase_storage_path,
      file_name: doc.file_name, performed_by: deletedBy, ip_address: req.ip,
    });

    res.json({ ok: true });
  } catch (e) { console.error("500 ERROR CAUGHT:", e); require("fs").appendFileSync("server_errors.log", String(e.stack) + "\n"); res.status(500).json({ error: e.message }); }
});

// ── Archive Quotation PDF to Drive ───────────────────────────────────────────
// Called from frontend after PDF render: POST /api/quotations/:id/archive-pdf
// Body: { pdfBase64, customerId, customerCode }
app.post('/api/quotations/:id/archive-pdf', requireAuth, async (req, res) => {
  try {
    const { pdfBase64, customerId, customerCode } = req.body;
    if (!pdfBase64) return res.status(400).json({ error: 'pdfBase64 is required' });

    const pdfBuffer = Buffer.from(pdfBase64, 'base64');
    const result = await PdfArchiveService.archiveQuotationPdf({
      quotationId: req.params.id,
      customerId,
      customerCode,
      pdfBuffer,
      generatedBy: (req.user && req.user.username) || 'system',
    });

    if (!result) return res.status(500).json({ error: 'PDF archiving failed' });
    res.json({ ok: true, ...result });
  } catch (e) { console.error("500 ERROR CAUGHT:", e); require("fs").appendFileSync("server_errors.log", String(e.stack) + "\n"); res.status(500).json({ error: e.message }); }
});

// ── Archive Invoice PDF to Drive ─────────────────────────────────────────────
app.post('/api/invoices/:id/archive-pdf', requireAuth, async (req, res) => {
  try {
    const { pdfBase64, customerId, customerCode } = req.body;
    if (!pdfBase64) return res.status(400).json({ error: 'pdfBase64 is required' });

    const pdfBuffer = Buffer.from(pdfBase64, 'base64');
    const result = await PdfArchiveService.archiveInvoicePdf({
      invoiceId: req.params.id,
      customerId,
      customerCode,
      pdfBuffer,
      generatedBy: (req.user && req.user.username) || 'system',
    });

    if (!result) return res.status(500).json({ error: 'PDF archiving failed' });
    res.json({ ok: true, ...result });
  } catch (e) { console.error("500 ERROR CAUGHT:", e); require("fs").appendFileSync("server_errors.log", String(e.stack) + "\n"); res.status(500).json({ error: e.message }); }
});

// ── Quotation Version History ────────────────────────────────────────────────
app.get('/api/quotations/:id/versions', async (req, res) => {
  try {
    if (!supa) return res.json([]);
    const versions = await supa.getQuotationVersions(req.params.id);
    res.json(versions);
  } catch (e) { console.error("500 ERROR CAUGHT:", e); require("fs").appendFileSync("server_errors.log", String(e.stack) + "\n"); res.status(500).json({ error: e.message }); }
});

// ── Invoice Version History ──────────────────────────────────────────────────
app.get('/api/invoices/:id/versions', async (req, res) => {
  try {
    if (!supa) return res.json([]);
    const versions = await supa.getInvoiceVersions(req.params.id);
    res.json(versions);
  } catch (e) { console.error("500 ERROR CAUGHT:", e); require("fs").appendFileSync("server_errors.log", String(e.stack) + "\n"); res.status(500).json({ error: e.message }); }
});

// ── Storage Status & Connection Test ────────────────────────────────────────
app.get('/api/storage/status', async (req, res) => {
  const supaStatus = supa ? await (async () => {
    try { await supa.checkTables(); return { ok: true, message: 'Connected' }; }
    catch (e) { return { ok: false, message: e.message }; }
  })() : { ok: false, message: 'Supabase not configured' };

  const storageStatus = await SupabaseStorageService.testConnection();

  res.json({
    supabase: supaStatus,
    googleDrive: { ok: false, message: 'Replaced by Supabase Storage' },
    supabaseStorage: storageStatus,
    storageConfigured: SupabaseStorageService.isStorageConfigured(),
    rootFolderId: null,
  });
});

// ── Audit Logs ───────────────────────────────────────────────────────────────
app.get('/api/audit-logs', requireAuth, async (req, res) => {
  try {
    if (!supa) return res.json([]);
    const { data } = await require('@supabase/supabase-js')
      .createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_KEY, { auth: { persistSession: false } })
      .from('audit_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(200);
    res.json(data || []);
  } catch (e) { console.error("500 ERROR CAUGHT:", e); require("fs").appendFileSync("server_errors.log", String(e.stack) + "\n"); res.status(500).json({ error: e.message }); }
});

// ══════════════════════════════════════════════════════════════════════════════
// ── SYSTEM HEALTH CHECK ENDPOINTS ──────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════════

// 1. Quick health (Docker / Nginx probe)
app.get('/api/health', async (req, res) => {
  res.json({ status: 'ok', service: 'node-backend', timestamp: new Date().toISOString() });
});

// 2. Comprehensive health check — tests everything
app.get('/api/system-health', async (req, res) => {
  const startTime = Date.now();
  const checks = {};

  // ── A. Environment Variables ────────────────────────────────────────
  const envVars = {
    SUPABASE_URL: !!process.env.SUPABASE_URL,
    SUPABASE_KEY: !!(process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_KEY),
    SUPABASE_BUCKET_NAME: !!process.env.SUPABASE_BUCKET_NAME,
  };
  const missingEnv = Object.entries(envVars).filter(([,v]) => !v).map(([k]) => k);
  checks.environment = {
    ok: missingEnv.length === 0,
    variables: envVars,
    missing: missingEnv,
    supabaseUrl: process.env.SUPABASE_URL ? process.env.SUPABASE_URL.replace(/\/\/(.{8}).*(@|\.supabase)/, '//$1***$2') : null,
    bucketName: process.env.SUPABASE_BUCKET_NAME || SupabaseStorageService.BUCKET_NAME || 'erp-documents',
  };

  // ── B. Database Connection ──────────────────────────────────────────
  const dbStart = Date.now();
  if (supa) {
    try {
      // First try the RPC for detailed diagnostics
      const { data, error } = await supa.rawClient.rpc('get_system_diagnostics');
      
      if (!error && data) {
        checks.database = {
          ok: true,
          message: 'Connected',
          latencyMs: Date.now() - dbStart,
          diagnostics: data,
        };
      } else {
        // Fallback to table check if RPC fails
        const tablesOk = await supa.checkTables();
        checks.database = {
          ok: tablesOk,
          message: tablesOk ? 'Connected' : 'Tables not found',
          latencyMs: Date.now() - dbStart,
          diagnostics: { tables_created: tablesOk ? 'Unknown' : 0 }
        };
      }
    } catch (e) {
      checks.database = { ok: false, message: e.message, latencyMs: Date.now() - dbStart };
    }
  } else {
    checks.database = { ok: false, message: 'Supabase not configured' };
  }

  // ── C. Storage Bucket ───────────────────────────────────────────────
  const storStart = Date.now();
  const storageStatus = await SupabaseStorageService.testConnection();
  checks.storage = {
    ...storageStatus,
    bucketName: SupabaseStorageService.BUCKET_NAME,
    latencyMs: Date.now() - storStart,
  };

  // ── D. Backend API ──────────────────────────────────────────────────
  checks.backendApi = { ok: true, message: 'Running', port: PORT };

  // ── E. Authentication ───────────────────────────────────────────────
  checks.authentication = {
    ok: true,
    method: 'JWT + Service Role',
    serviceKeyConfigured: !!(process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_KEY),
  };

  // ── F. Overall ──────────────────────────────────────────────────────
  const allOk = checks.environment.ok && checks.database.ok && checks.storage.ok && checks.backendApi.ok;
  res.json({
    status: allOk ? 'healthy' : 'degraded',
    timestamp: new Date().toISOString(),
    totalLatencyMs: Date.now() - startTime,
    checks,
  });
});

// 3. Database CRUD Test — create, read, update, delete a temp record
app.post('/api/system-health/test-crud', async (req, res) => {
  console.log('\n=====================================');
  console.log('SUPABASE DATABASE TEST');
  console.log('=====================================');
  console.log('Connecting...');
  
  if (!supa) {
    console.log('FAILED\nReason: Database not connected');
    return res.json({ ok: false, message: 'Database not connected' });
  }
  
  console.log('SUCCESS');

  const results = { create: null, read: null, update: null, delete: null };
  const testCode = `TEST-000001`;
  
  try {
    // CREATE
    console.log('Creating Dummy Customer...');
    const createStart = Date.now();
    const created = await supa.rawClient.from('customers').insert([{
      customer_code: testCode,
      name: 'Database Connection Test',
      phone: '9999999999',
      status: 'Lead',
    }]).select().single();
    if (created.error) throw new Error(created.error.message);
    results.create = { ok: !!created.data, latencyMs: Date.now() - createStart };
    console.log('SUCCESS');

    // READ
    console.log('Reading Dummy Customer...');
    const readStart = Date.now();
    const found = await supa.rawClient.from('customers').select('*').eq('customer_code', testCode).single();
    if (found.error) throw new Error(found.error.message);
    const isValidRead = found.data.id && found.data.name === 'Database Connection Test' && found.data.customer_code === testCode;
    if (!isValidRead) throw new Error('Data mismatch on read');
    results.read = { ok: true, latencyMs: Date.now() - readStart };
    console.log('SUCCESS');

    // UPDATE
    console.log('Updating Dummy Customer...');
    const updateStart = Date.now();
    const updated = await supa.rawClient.from('customers').update({ name: 'Database CRUD Test Updated' }).eq('customer_code', testCode).select().single();
    if (updated.error) throw new Error(updated.error.message);
    const isValidUpdate = updated.data.name === 'Database CRUD Test Updated';
    if (!isValidUpdate) throw new Error('Data mismatch on update');
    results.update = { ok: true, latencyMs: Date.now() - updateStart };
    console.log('SUCCESS');

    // DELETE
    console.log('Deleting Dummy Customer...');
    const delStart = Date.now();
    const deleted = await supa.rawClient.from('customers').delete().eq('customer_code', testCode).select();
    if (deleted.error) throw new Error(deleted.error.message);
    results.delete = { ok: true, latencyMs: Date.now() - delStart };
    console.log('SUCCESS');

    console.log('All CRUD operations completed.');
    console.log('=====================================\n');
    res.json({ ok: true, results });
  } catch (e) {
    console.log('FAILED');
    console.log(`Reason:\n${e.message}`);
    console.log('=====================================\n');
    // Attempt cleanup if failed
    supa.rawClient.from('customers').delete().eq('customer_code', testCode).then(()=>{}).catch(()=>{});
    res.json({ ok: false, message: e.message, results });
  }
});

// 4. Storage Upload/Download/Delete Test
app.post('/api/system-health/test-storage', async (req, res) => {
  if (!SupabaseStorageService.isStorageConfigured()) {
    return res.json({ ok: false, message: 'Storage not configured' });
  }
  const results = { upload: null, download: null, delete: null };
  const testPath = `_health_checks/health-check-${Date.now()}.txt`;
  const testContent = `TheVoltaura ERP Health Check — ${new Date().toISOString()}`;
  const testBuffer = Buffer.from(testContent, 'utf-8');

  try {
    // UPLOAD
    const upStart = Date.now();
    const uploaded = await SupabaseStorageService.uploadFile({
      buffer: testBuffer,
      path: testPath,
      mimeType: 'text/plain',
    });
    results.upload = { ok: true, path: uploaded.path, latencyMs: Date.now() - upStart, sizeBytes: testBuffer.length };

    // DOWNLOAD
    const dlStart = Date.now();
    const downloaded = await SupabaseStorageService.downloadFile(testPath);
    const downloadedText = downloaded.buffer.toString('utf-8');
    const checksumMatch = downloadedText === testContent;
    results.download = { ok: checksumMatch, latencyMs: Date.now() - dlStart, checksumMatch };

    // DELETE
    const delStart = Date.now();
    await SupabaseStorageService.deleteFile(testPath);
    results.delete = { ok: true, latencyMs: Date.now() - delStart };

    res.json({ ok: true, results });
  } catch (e) {
    res.json({ ok: false, message: e.message, results });
  }
});

// 5. Storage Folder Structure Test
app.post('/api/system-health/test-folders', async (req, res) => {
  if (!SupabaseStorageService.isStorageConfigured()) {
    return res.json({ ok: false, message: 'Storage not configured' });
  }
  const testBase = `_health_checks/CUST-TEST`;
  const folders = ['Documents', 'Quotations', 'Invoices', 'Payments'];
  const results = [];
  try {
    for (const folder of folders) {
      const testPath = `${testBase}/${folder}/.keep`;
      const start = Date.now();
      await SupabaseStorageService.uploadFile({
        buffer: Buffer.from(''),
        path: testPath,
        mimeType: 'text/plain',
      });
      results.push({ folder, ok: true, latencyMs: Date.now() - start });
      // Cleanup
      await SupabaseStorageService.deleteFile(testPath);
    }
    res.json({ ok: true, results });
  } catch (e) {
    res.json({ ok: false, message: e.message, results });
  }
});

// 6. Recent Audit Logs for health dashboard
app.get('/api/system-health/recent-logs', async (req, res) => {
  try {
    if (!supa) return res.json([]);
    const { createClient } = require('@supabase/supabase-js');
    const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_KEY, { auth: { persistSession: false } });
    const { data } = await sb
      .from('audit_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50);
    res.json(data || []);
  } catch (e) { res.json([]); }
});

app.post('/api/system-health/test-documents', async (req, res) => {
  if (!SupabaseStorageService.isStorageConfigured()) {
    return res.json({ ok: false, message: 'Storage not configured' });
  }
  const results = { generate: false, upload: false, dbMetadata: false, delete: false };
  const testId = `TEST-DOC-${Date.now()}`;
  const testPath = `_health_checks/${testId}.pdf`;
  
  try {
    // 1. Generate (Mock PDF Blob)
    const dummyPdfContent = Buffer.from('%PDF-1.4\\nTest Quotation PDF content...', 'utf-8');
    results.generate = true;

    // 2. Upload to Storage
    let upRes;
    try {
      upRes = await SupabaseStorageService.uploadFile({
        path: testPath,
        buffer: dummyPdfContent,
        mimeType: 'application/pdf'
      });
      results.upload = true;
    } catch (e) {
      throw new Error('Upload failed: ' + e.message);
    }

    // 3. Save metadata to Postgres (using Quotations as a test bed)
    const mockRecord = {
      id: testId,
      status: 'Draft',
      grand_total: 100,
      latest_pdf_storage_path: upRes.path
    };
    await createEntity('quotations', mockRecord);
    results.dbMetadata = true;

    // 4. Clean up (Delete Record and File)
    await deleteEntity('quotations', testId);
    await SupabaseStorageService.deleteFile(testPath);
    results.delete = true;

    res.json({ ok: true, message: 'Document lifecycle verified', results });
  } catch (e) {
    res.json({ ok: false, message: e.message, results });
  }
});

// ── Strict Supabase Initialization ─────────────────────────────────────
let supa = null;
try {
  supa = require('./backend/repos/supabaseRepo');
  console.log('✅ Supabase backend loaded securely');
} catch (e) {
  console.error('❌ CRITICAL: Failed to load supabaseRepo. Backend cannot start.', e.message);
  process.exit(1);
}

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

function seedLocalDataIfNeeded() {
  ensureDataDir();
  const now = new Date().toISOString();
  const defaults = {
    'users.json': [
      { id: 'usr-1', username: 'admin', password: 'admin', role: 'super_admin', tenant_id: 'admin', franchise_id: null, created_at: now }
    ],
    'customers.json': [],
    'products.json': [],
    'quotations.json': [],
    'invoices.json': [],
    'payments.json': [],
    'orders.json': [],
    'amc.json': [],
    'notifications.json': [],
    'franchises.json': [],
    'settings.json': [{ id: 'global', global_settings: {} }],
  };
  for (const [file, value] of Object.entries(defaults)) {
    const filePath = path.join(DATA_DIR, file);
    if (!fs.existsSync(filePath)) {
      fs.writeFileSync(filePath, JSON.stringify(value, null, 2), 'utf8');
    }
  }
}
seedLocalDataIfNeeded();

async function readDataFile(fileName) {
  if (process.env.NODE_ENV === 'production' && supabaseOnline()) {
    throw new Error(`Database operation failed. Fallback to local JSON is disabled in production for ${fileName}.`);
  }
  try {
    ensureDataDir();
    const filePath = path.join(DATA_DIR, fileName);
    if (!fs.existsSync(filePath)) return [];
    const raw = await fs.promises.readFile(filePath, 'utf8');
    const parsed = JSON.parse(raw || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    console.warn('[local-store] read failed', fileName, e.message);
    return [];
  }
}

async function writeDataFile(fileName, data) {
  if (process.env.NODE_ENV === 'production' && supabaseOnline()) {
    throw new Error(`Database operation failed. Fallback to local JSON is disabled in production for ${fileName}.`);
  }
  ensureDataDir();
  const filePath = path.join(DATA_DIR, fileName);
  await fs.promises.writeFile(filePath, JSON.stringify(data, null, 2), 'utf8');
  return true;
}

function nextId(list, prefix = 'ID') {
  const max = list.reduce((m, it) => {
    const n = parseInt(String(it.id || '').replace(/[^0-9]/g, ''), 10) || 0;
    return Math.max(m, n);
  }, 0);
  return `${prefix}-${max + 1}`;
}

function idPrefix(entityName) {
  return {
    customers: 'CUST', products: 'PROD', invoices: 'INV', quotations: 'QT',
    payments: 'PAY', amc: 'AMC', notifications: 'NTF', orders: 'ORD', users: 'USR',
  }[entityName] || 'ID';
}

function supabaseOnline() {
  return Boolean(supa && typeof supa.isAvailable === 'function' && supa.isAvailable());
}

async function listEntities(entityName) {
  if (supabaseOnline()) {
    try {
      const res = await supa.list(entityName);
      if (res !== null && res !== undefined) return Array.isArray(res) ? res : [];
    } catch (e) {
      console.warn(`[listEntities] ${entityName}:`, e.message);
    }
  }
  return readDataFile(`${entityName}.json`);
}

async function createEntity(entityName, payload) {
  if (supabaseOnline()) {
    try {
      const res = await supa.create(entityName, payload);
      if (res) return res;
    } catch (e) {
      console.warn(`[createEntity] ${entityName}:`, e.message);
    }
  }
  const list = await readDataFile(`${entityName}.json`);
  const record = Object.assign({ id: payload.id || nextId(list, idPrefix(entityName)), createdAt: new Date().toISOString() }, payload);
  list.push(record);
  await writeDataFile(`${entityName}.json`, list);
  return record;
}

async function findEntity(entityName, id) {
  if (supabaseOnline()) {
    try {
      const res = await supa.find(entityName, id);
      if (res) return res;
    } catch (e) {
      console.warn(`[findEntity] ${entityName}:`, e.message);
    }
  }
  const list = await readDataFile(`${entityName}.json`);
  return list.find((it) => String(it.id) === String(id)) || null;
}

async function updateEntity(entityName, id, updates) {
  if (supabaseOnline()) {
    try {
      const res = await supa.update(entityName, id, updates);
      if (res) return res;
    } catch (e) {
      console.warn(`[updateEntity] ${entityName}:`, e.message);
    }
  }
  const list = await readDataFile(`${entityName}.json`);
  const idx = list.findIndex((it) => String(it.id) === String(id));
  if (idx === -1) {
    const record = Object.assign({ id }, updates);
    list.push(record);
    await writeDataFile(`${entityName}.json`, list);
    return record;
  }
  list[idx] = Object.assign({}, list[idx], updates);
  await writeDataFile(`${entityName}.json`, list);
  return list[idx];
}

async function deleteEntity(entityName, id) {
  if (supabaseOnline()) {
    try {
      const res = await supa.remove(entityName, id);
      if (res !== null && res !== undefined) return res;
    } catch (e) {
      console.warn(`[deleteEntity] ${entityName}:`, e.message);
    }
  }
  const list = await readDataFile(`${entityName}.json`);
  const idx = list.findIndex((it) => String(it.id) === String(id));
  if (idx === -1) return null;
  const removed = list.splice(idx, 1)[0];
  await writeDataFile(`${entityName}.json`, list);
  return removed;
}

async function listForRequest(entityName, tenant) {
  if (!tenant?.is_super_admin && supabaseOnline() && typeof supa.listByTenant === 'function') {
    try {
      const rows = await supa.listByTenant(entityName, tenant?.id, tenant?.franchise_id);
      if (rows !== null && rows !== undefined) return rows;
    } catch (e) {
      console.warn(`[listByTenant] ${entityName}:`, e.message);
    }
  }
  return listEntities(entityName);
}

// Generate next dynamic ID for invoices or quotations from settings
async function generateNextId(type) {
  return await DocumentNumberService.generateNextId(type, listEntities, updateEntity);
}

// --------------------
// Simple Auth Stub
// --------------------
// POST /api/auth/login => { token }
// Use header `x-demo-auth: <token>` to authenticate protected routes
// We'll support both a demo token (for quick dev) and JWT for auth.
const DEMO_TOKEN = 'demo-token-12345';

// Simple user store (file-backed)
async function getUsers() {
  return await listEntities('users');
}

async function saveUsers(users) {
  if (!supa) throw new Error('Database connection failed.');
  for (const u of users) {
    if (!u.id) await createEntity('users', u);
  }
  return true;
}

app.post('/api/auth/register', async (req, res) => {
  try {
    const { username, password } = req.body || {};
    if (!username || !password) return res.status(400).json({ error: 'Missing fields' });
    const users = await getUsers();
    if (users.find(u => u.username === username)) return res.status(409).json({ error: 'User exists' });
    const hash = await bcrypt.hash(password, 10);
    const userPayload = { username, password: hash, role: 'user' };
    let user = await createEntity('users', userPayload);
    res.status(201).json({ id: user.id, username: user.username });
  } catch (e) {
    res.status(500).json({ error: e.message || 'Server error' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password, franchise_id: loginFranchiseId } = req.body || {};
    if (username === 'admin' && password === 'admin') {
      const token = jwt.sign({ username: 'admin', role: 'super_admin', tenant_id: 'admin', franchise_id: null }, JWT_SECRET, { expiresIn: '8h' });
      return res.json({
        token,
        role: 'super_admin',
        user: { username: 'admin', role: 'super_admin', tenant_id: 'admin', franchise_id: null },
        permissions: getPermissionsForRole('super_admin')
      });
    }
    let users = [];
    try {
      users = (await getUsers()) || [];
    } catch (e) {
      console.warn('[auth] user lookup failed:', e.message);
      users = [];
    }
    const user = users.find(u => u.username === username);
    // allow demo super admin (admin / admin)
    if (!user && username === 'admin' && password === 'admin') {
      const token = jwt.sign({ username: 'admin', role: 'super_admin', tenant_id: 'admin', franchise_id: null }, JWT_SECRET, { expiresIn: '8h' });
      return res.json({
        token,
        role: 'super_admin',
        user: { username: 'admin', role: 'super_admin', tenant_id: 'admin', franchise_id: null },
        permissions: getPermissionsForRole('super_admin')
      });
    }
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });

    if (user.franchise_id && loginFranchiseId && user.franchise_id !== loginFranchiseId) {
      return res.status(401).json({ error: 'Invalid Franchise ID' });
    }

    if (user.franchise_id) {
      try {
        const { data: fr } = await supa.rawClient.from('franchises').select('status').eq('id', user.franchise_id).single();
        if (fr && fr.status === 'Suspended') {
          return res.status(403).json({ error: 'Account suspended', message: 'Your franchise account has been suspended. Please contact TheVoltaura Head Office.' });
        }
      } catch (e) { /* non-fatal */ }
    }

    const ok = await bcrypt.compare(password, user.password);
    if (!ok) return res.status(401).json({ error: 'Invalid credentials' });

    try { await updateEntity('users', user.id, { last_login_at: new Date().toISOString() }); } catch(e) {}
    
    const role = (user.role === 'admin' || user.role === 'head_office') ? 'super_admin' : (user.role || 'franchise_admin');
    const tokenPayload = { 
      username:    user.username, 
      role,
      tenant_id:   user.tenant_id   || 'admin', 
      franchise_id: user.franchise_id || null,
    };
    const token = jwt.sign(tokenPayload, JWT_SECRET, { expiresIn: '8h' });
    res.json({
      token,
      role,
      user: tokenPayload,
      permissions: getPermissionsForRole(role),
    });
  } catch (e) {
    console.error("500 ERROR CAUGHT:", e);
    res.status(500).json({ error: e.message || 'Server error' });
  }
});

function requireAuth(req, res, next) {
  const token = req.headers['authorization'] || req.headers['x-demo-auth'];
  if (!token) return res.status(401).json({ error: 'Missing auth token' });
  const raw = token.toString().replace(/^Bearer\s+/i, '');
  
  if (raw === DEMO_TOKEN) {
    req.user = { username: 'admin', role: 'super_admin', tenant_id: 'admin', franchise_id: null };
    req.tenant = { id: 'admin', franchise_id: null, role: 'super_admin', username: 'admin', is_super_admin: true, is_franchise_admin: false, is_franchise_staff: false };
    return next();
  }
  
  try {
    const payload = jwt.verify(raw, JWT_SECRET);
    req.user = payload;
    if (!req.user.tenant_id) req.user.tenant_id = 'admin';
    if (req.user.role === 'admin' || req.user.role === 'head_office') req.user.role = 'super_admin';
    // Attach req.tenant for convenience
    req.tenant = {
      id:                req.user.tenant_id,
      franchise_id:      req.user.franchise_id || null,
      role:              req.user.role,
      username:          req.user.username,
      is_super_admin:    (req.user.role === 'super_admin'),
      is_franchise_admin:(req.user.role === 'franchise_admin'),
      is_franchise_staff:(req.user.role === 'franchise_staff'),
    };
    return next();
  } catch (e) {
    return res.status(403).json({ error: 'Invalid token' });
  }
}

// --- Customers ---
app.get('/api/customers', requireAuth, async (req, res) => {
  try {
    const customers = await listForRequest('customers', req.tenant);
    const mapped = customers.map(c => ({
        id: c.id,
        customerCode: c.customer_code || c.id,
        name: c.name || c.company_name,
        companyName: c.company_name || c.name,
        email: c.email,
        phone: c.phone || c.mobile,
        address: c.address,
        gstin: c.gstin,
        status: c.status,
        createdAt: c.created_at || c.createdAt
    }));
    res.json(mapped);
  } catch (e) { console.error("500 ERROR CAUGHT:", e); require("fs").appendFileSync("server_errors.log", String(e.stack) + "\n"); res.status(500).json({ error: e.message }); }
});

app.get('/api/customers/:id', async (req, res) => {
  try {
    const c = await findEntity('customers', req.params.id);
    if (!c) return res.status(404).json({ error: 'Not found' });
    res.json(c);
  } catch (e) { console.error("500 ERROR CAUGHT:", e); require("fs").appendFileSync("server_errors.log", String(e.stack) + "\n"); res.status(500).json({ error: e.message }); }
});

app.post('/api/customers', requireAuth, async (req, res) => {
  try {
    const payload = { ...req.body, ...tenantPayload(req.tenant) };

    // Auto-generate customer code if not provided
    // Only call supa methods when Supabase is actually reachable (circuit not open)
    if (!payload.customer_code && supabaseOnline()) {
      try {
        payload.customer_code = await supa.generateCustomerCode();
      } catch (e) {
        console.warn('[customers] generateCustomerCode failed, using local fallback:', e.message);
      }
    }
    // Local fallback for customer code generation
    if (!payload.customer_code) {
      const existing = await readDataFile('customers.json');
      const max = existing.reduce((m, c) => {
        const n = parseInt(String(c.customer_code || c.id || '').replace(/[^0-9]/g, ''), 10) || 0;
        return Math.max(m, n);
      }, 0);
      payload.customer_code = `CUST-${String(max + 1).padStart(6, '0')}`;
    }
    if (!payload.id) payload.id = payload.customer_code;

    let record;
    if (supabaseOnline()) {
      try {
        record = await supa.createCustomer(payload);
      } catch (e) {
        console.warn('[customers] supa.createCustomer failed, using local fallback:', e.message);
      }
    }
    if (!record) {
      record = await createEntity('customers', payload);
    }
    if (!record) throw new Error("Database insertion failed");

    try { broadcastEvent({ type: 'customer.created', data: record }, record.organization_id || null); } catch (e) { }
    res.status(201).json(record);
  } catch (e) { console.error("500 ERROR CAUGHT:", e); require("fs").appendFileSync("server_errors.log", String(e.stack) + "\n"); res.status(500).json({ error: e.message }); }
});


app.put('/api/customers/:id', requireAuth, async (req, res) => {
  try {
    const upd = await updateEntity('customers', req.params.id, req.body);
    if (!upd) return res.status(404).json({ error: 'Not found' });
    res.json(upd);
  } catch (e) { console.error("500 ERROR CAUGHT:", e); require("fs").appendFileSync("server_errors.log", String(e.stack) + "\n"); res.status(500).json({ error: e.message }); }
});

app.delete('/api/customers/:id', requireAuth, async (req, res) => {
  try {
    const removed = await deleteEntity('customers', req.params.id);
    if (!removed) return res.status(404).json({ error: 'Not found' });
    res.json({ ok: true });
  } catch (e) { console.error("500 ERROR CAUGHT:", e); require("fs").appendFileSync("server_errors.log", String(e.stack) + "\n"); res.status(500).json({ error: e.message }); }
});

// --- Products ---
app.get('/api/products', requireAuth, async (req, res) => {
  try {
    let products = await listEntities('products');
    if (!req.tenant || !req.tenant.is_super_admin) {
        products = products.map(p => {
            const { netPrice, ...rest } = p;
            return rest;
        });
    }
    res.json(products);
  } catch (e) { console.error("500 ERROR CAUGHT:", e); require("fs").appendFileSync("server_errors.log", String(e.stack) + "\n"); res.status(500).json({ error: e.message }); }
});

app.get('/api/products/:id', requireAuth, async (req, res) => {
  try {
    const p = await findEntity('products', req.params.id);
    if (!p) return res.status(404).json({ error: 'Not found' });
    if (!req.tenant || !req.tenant.is_super_admin) {
        delete p.netPrice;
    }
    res.json(p);
  } catch (e) { console.error("500 ERROR CAUGHT:", e); require("fs").appendFileSync("server_errors.log", String(e.stack) + "\n"); res.status(500).json({ error: e.message }); }
});

app.post('/api/products', requireAuth, async (req, res) => {
  try {
    if (!req.tenant || !req.tenant.is_super_admin) return res.status(403).json({ error: 'Only Super Admin can add products' });
    const payload = req.body;
    const record = await createEntity('products', payload);
    try { broadcastEvent({ type: 'product.created', data: record }, record.organization_id || null); } catch (e) { }
    res.status(201).json(record);
  } catch (e) { console.error("500 ERROR CAUGHT:", e); require("fs").appendFileSync("server_errors.log", String(e.stack) + "\n"); res.status(500).json({ error: e.message }); }
});

app.put('/api/products/:id', requireAuth, async (req, res) => {
  try {
    if (!req.tenant || !req.tenant.is_super_admin) return res.status(403).json({ error: 'Only Super Admin can edit product details' });
    const upd = await updateEntity('products', req.params.id, req.body);
    if (!upd) return res.status(404).json({ error: 'Not found' });
    res.json(upd);
  } catch (e) { console.error("500 ERROR CAUGHT:", e); require("fs").appendFileSync("server_errors.log", String(e.stack) + "\n"); res.status(500).json({ error: e.message }); }
});

app.delete('/api/products/:id', requireAuth, async (req, res) => {
  try {
    const removed = await deleteEntity('products', req.params.id);
    if (!removed) return res.status(404).json({ error: 'Not found' });
    res.json({ ok: true });
  } catch (e) { console.error("500 ERROR CAUGHT:", e); require("fs").appendFileSync("server_errors.log", String(e.stack) + "\n"); res.status(500).json({ error: e.message }); }
});

// --- Quotations ---
app.get('/api/quotations', requireAuth, async (req, res) => {
  try {
    const quotes = await listForRequest('quotations', req.tenant);
    res.json(quotes || []);
  } catch (e) {
    console.warn('[quotations] list failed:', e.message);
    res.json([]);
  }
});

app.get('/api/quotations/:id', async (req, res) => {
  try {
    const q = await findEntity('quotations', req.params.id);
    if (!q) return res.status(404).json({ error: 'Not found' });
    res.json(q);
  } catch (e) { console.error("500 ERROR CAUGHT:", e); require("fs").appendFileSync("server_errors.log", String(e.stack) + "\n"); res.status(500).json({ error: e.message }); }
});

app.post('/api/quotations', requireAuth, async (req, res) => {
  try {
    const autoId = await generateNextId('quotation');
    const tp = tenantPayload(req.tenant);
    // Franchise users: new quotations start as Draft with approval_status=Draft
    const approvalDefaults = req.tenant?.is_super_admin
      ? { approval_status: 'Approved' }
      : { approval_status: 'Draft' };
    const payload = Object.assign({ id: autoId, status: 'Draft', createdAt: new Date().toISOString() }, approvalDefaults, tp, req.body);
    if (payload.status === 'Quoted') payload.status = 'Sent';
    const record = await createEntity('quotations', payload);
    try { broadcastEvent({ type: 'quotation.created', data: record }, record.organization_id || null); } catch (e) { }
    res.status(201).json(record);
  } catch (e) { console.error("500 ERROR CAUGHT:", e); require("fs").appendFileSync("server_errors.log", String(e.stack) + "\n"); res.status(500).json({ error: e.message }); }
});

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
        const newCustPayload = {
            name: parsedCustomerInfo.ebName || 'New Customer',
            mobile: mobile,
            email: email,
            customerInfo: parsedCustomerInfo,
            status: 'Active'
        };
        if (supabaseOnline()) {
            try { customerRecord = await supa.createCustomer(newCustPayload); } catch(e) { console.warn('[complete-customer] supa.createCustomer failed:', e.message); }
        }
        if (!customerRecord) customerRecord = await createEntity('customers', newCustPayload);
        if (!customerRecord) throw new Error('Unable to create customer');
        customerId = customerRecord.id;
    }
    
    if (!customerRecord) {
        return res.status(500).json({ error: 'Unable to save customer information. Please try again.' });
    }

    // 2. Process Files
    const uploadedDocs = {};
    
    console.log("Complete Customer - Processing files:", req.files ? req.files.length : 0);
    console.log("Storage configured:", SupabaseStorageService.isStorageConfigured());
    console.log("Supa available:", !!supa);

    if (req.files && req.files.length > 0 && SupabaseStorageService.isStorageConfigured() && supa) {
        const customerCode = customerRecord.customer_code || `CUST-${customerId}`;
        
        for (const file of req.files) {
            console.log("Processing file:", file.fieldname);
            const documentType = file.fieldname; // 'pan', 'aadhaar', 'eb_receipt' etc.
            const subfolder = SupabaseStorageService.getSubfolderForDocumentType(documentType);
            const fileName = `${documentType.toUpperCase()}_${Date.now()}_${file.originalname.replace(/\s+/g, '_')}`;
            const filePath = `${customerCode}/${subfolder}/${fileName}`;
            
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
                    quotation_id: (quotationId && quotationId !== 'new') ? quotationId : null,
                    bucket_name: 'erp-documents',
                    document_type: documentType,
                    file_name: fileName,
                    supabase_storage_path: uploaded.path,
                    mime_type: file.mimetype,
                    uploaded_by: uploadedBy
                });
                
                if (docRecord) {
                    uploadedDocs[documentType] = {
                        id: docRecord.id,
                        name: docRecord.file_name,
                        url: uploaded.publicUrl || `/api/documents/download/${docRecord.id}`,
                        type: docRecord.mime_type,
                        uploadedAt: docRecord.uploaded_at
                    };
                    console.log(`\n${documentType === 'pan' ? 'PAN' : documentType === 'aadhaar' ? 'Aadhaar' : documentType === 'eb_receipt' ? 'EB Receipt' : documentType} Uploaded\nMetadata Saved\nSupabase Storage Path:\nerp-documents/Customers/${customerCode}/Documents/`);
                }
            } catch (err) {
                console.error(`Failed to upload ${documentType}:`, err);
                // Continue with other files even if one fails
            }
        }
    }
    
    // Merge new docs into existing customer docs if updating
    let finalDocs = uploadedDocs;
    if (!isNewCustomer && customerRecord.documents) {
        finalDocs = { ...customerRecord.documents, ...uploadedDocs };
    }
    await updateEntity('customers', customerId, { documents: finalDocs });

    // 3. Link to Quotation
    let linkedToQuotation = false;
    if (quotationId && quotationId !== 'undefined' && quotationId !== 'null' && quotationId !== '' && quotationId !== 'new') {
        try {
            await updateEntity('quotations', quotationId, { 
                customer_id: customerId,
                customer_info_completed: true,
                customer_documents_completed: true,
                completion_status: 'COMPLETED'
            });
            linkedToQuotation = true;
        } catch (e) {
            console.error('Failed to link quotation to customer:', e);
        }
    }

    console.log(`\nCustomer Information Saved\n\nCustomer ID:\n${customerId}\n`);
    if (linkedToQuotation) console.log(`Quotation Linked:\n${quotationId}\n`);
    console.log(`Customer Information Status:\nCOMPLETED\n`);

    res.json({
        success: true,
        customerCompleted: true,
        quotationUpdated: linkedToQuotation,
        documentsUploaded: true,
        customer: {
            ...customerRecord,
            documents: finalDocs
        }
    });

  } catch (e) { 
      console.error("500 ERROR CAUGHT:", e); 
      require("fs").appendFileSync("server_errors.log", String(e.stack) + "\n"); 
      res.status(500).json({ error: e.message }); 
  }
});

app.put('/api/quotations/:id', requireAuth, async (req, res) => {
  try {
    console.log('PUT /api/quotations/:id', req.params.id, JSON.stringify(req.body).slice(0, 500));
    const upd = await updateEntity('quotations', req.params.id, req.body);
    if (!upd) return res.status(404).json({ error: 'Not found' });
    res.json(upd);
  } catch (e) { console.error("500 ERROR CAUGHT:", e); require("fs").appendFileSync("server_errors.log", String(e.stack) + "\n"); res.status(500).json({ error: e.message }); }
});

app.delete('/api/quotations/:id', requireAuth, async (req, res) => {
  try {
    const removed = await deleteEntity('quotations', req.params.id);
    if (!removed) return res.status(404).json({ error: 'Not found' });
    res.json({ ok: true });
  } catch (e) { console.error("500 ERROR CAUGHT:", e); require("fs").appendFileSync("server_errors.log", String(e.stack) + "\n"); res.status(500).json({ error: e.message }); }
});

// Convert quotation to invoice
app.post('/api/quotations/:id/convert', requireAuth, async (req, res) => {
  try {
    const q = await findEntity('quotations', req.params.id);
    if (!q) return res.status(404).json({ error: 'Quotation not found' });

    // Prevent duplicate invoice creation
    const existingInvoiceId = q.invoice_id || q.invoiceId;
    if (q.status === 'Invoiced' && existingInvoiceId) {
      const existing = await findEntity('invoices', existingInvoiceId).catch(() => null);
      if (existing) return res.status(200).json(existing); // return the already-created invoice
    }

    const autoId = await generateNextId('invoice');

    // Deep copy items to break reference so updates don't bleed back
    const clonedItems = (q.items || []).map(it => ({ ...it }));

    let validCustId = q.customer_id || q.customerId;
    if (validCustId) {
      try {
        const custExists = await findEntity('customers', validCustId);
        if (!custExists) validCustId = null;
      } catch (e) {
        validCustId = null;
      }
    }

    const invoicePayload = {
      id: autoId,
      quotation_id: q.id,
      customer_id: validCustId,
      customer_name: q.customer_name || q.customerName,
      company_branch_id: null, // Avoid UUID cast error for dummy "1"
      company_gst: q.company_gst || q.companyGst,
      company_address: q.company_address || q.companyAddress,
      date: q.date,
      due_date: q.valid_until || q.validUntil,
      billing_addr: q.billing_addr || q.billingAddr,
      site_addr: q.site_addr || q.siteAddr,
      subtotal: q.subtotal,
      discount: q.discount,
      total_tax: q.total_tax || q.totalTax,
      grand_total: q.grand_total || q.grandTotal,
      total: q.grand_total || q.grandTotal,
      paid: 0,
      status: 'Pending',
      items: clonedItems,
      notes: q.notes,
      created_at: new Date().toISOString()
    };
    const invoice = await createEntity('invoices', invoicePayload);

    // Update quotation: status = Invoiced, store linked invoice ID
    await updateEntity('quotations', req.params.id, {
      status: 'Invoiced',
      invoice_id: invoice.id
    });

    // Create a notification for the conversion
    await createEntity('notifications', {
      title: 'Quotation Converted',
      desc: `Quotation ${q.id} converted to invoice ${invoice.id}`,
      type: 'success',
      link: `/view-invoice/${invoice.id}`,
      read: false,
      createdAt: new Date().toISOString()
    });

    try { broadcastEvent({ type: 'invoice.created', data: invoice }); } catch (e) { }
    res.status(201).json(invoice);
  } catch (e) { console.error("500 ERROR CAUGHT:", e); require("fs").appendFileSync("server_errors.log", String(e.stack) + "\n"); res.status(500).json({ error: e.message }); }
});


// --- Orders (Priority Orders) ---
app.get('/api/orders', requireAuth, async (req, res) => {
  try {
    const orders = await listForRequest('orders', req.tenant);
    const quotations = await listEntities('quotations');
    const customers = await listEntities('customers');

    const mapped = orders.map(o => {
        const quo = quotations.find(q => q.id === (o.quotation_id || o.quotationId)) || {};
        const cust = customers.find(c => c.id === (o.customer_id || o.customerId || quo.customer_id || quo.customerId)) || {};
        
        return {
            id: o.id,
            quotationId: o.quotation_id || o.quotationId,
            quotationNumber: quo.id || o.quotation_number || o.quotationNumber,
            customerId: cust.id || o.customer_id || o.customerId,
            customerName: cust.name || cust.company_name || o.customer_name || o.customerName,
            projectSize: quo.project_size || quo.projectSize || o.project_size || o.projectSize,
            grandTotal: quo.grand_total || quo.grandTotal || o.grand_total || o.grandTotal,
            advanceAmount: quo.paid || o.advance_amount || o.advanceAmount,
            status: o.order_status || o.status,
            createdAt: o.created_at || o.createdAt,
            priorityLevel: o.priority || o.priority_level || o.priorityLevel || 'Normal',
            priorityIndex: o.priority_index || o.priorityIndex,
            currentStage: o.order_status || o.current_stage || o.currentStage,
            assignedEngineer: o.assigned_to || o.assigned_engineer || o.assignedEngineer,
            expectedInstallationDate: o.target_date || o.expected_installation_date || o.expectedInstallationDate,
            actualCompletionDate: o.completed_date || o.actual_completion_date || o.actualCompletionDate
        };
    });
    res.json(mapped.sort((a, b) => (a.priorityIndex || 0) - (b.priorityIndex || 0)));
  } catch (e) { console.error("500 ERROR CAUGHT:", e); require("fs").appendFileSync("server_errors.log", String(e.stack) + "\n"); res.status(500).json({ error: e.message }); }
});

app.post('/api/orders', requireAuth, async (req, res) => {
  try {
    const orders = await listEntities('orders');
    const priorityIndex = orders.length + 1;
    
    // Auto-generate sequential Order ID if not provided, or if using old format
    let orderId = req.body.id;
    if (!orderId || !orderId.startsWith('ORD-') || orderId.length > 12) {
        // Find highest sequential ID
        let maxSeq = 0;
        orders.forEach(o => {
            const match = o.id.match(/^ORD-(\d{6})$/);
            if (match) {
                const num = parseInt(match[1], 10);
                if (num > maxSeq) maxSeq = num;
            }
        });
        const nextSeq = maxSeq > 0 ? maxSeq + 1 : (orders.length + 1);
        orderId = `ORD-${String(nextSeq).padStart(6, '0')}`;
    }

    let validCustId = req.body.customerId || req.body.customer_id;
    if (validCustId) {
      try {
        const custExists = await getEntity('customers', validCustId);
        if (!custExists) validCustId = null;
      } catch (e) {
        validCustId = null;
      }
    }

    const payload = {
        id: orderId,
        quotation_id: req.body.quotationId || req.body.quotation_id,
        quotation_number: req.body.quotationNumber || req.body.quotation_number,
        customer_id: validCustId,
        customer_name: req.body.customerName || req.body.customer_name,
        project_size: req.body.projectSize || req.body.project_size,
        grand_total: req.body.grandTotal || req.body.grand_total,
        advance_amount: req.body.advanceAmount || req.body.advance_amount,
        payment_mode: req.body.paymentMode || req.body.payment_mode,
        utr_number: req.body.utrNumber || req.body.utr_number,
        received_by: req.body.receivedBy || req.body.received_by,
        payment_date: req.body.paymentDate || req.body.payment_date,
        remarks: req.body.remarks,
        status: req.body.status || 'Confirmed Order',
        created_at: new Date().toISOString(),
        priority_level: 'Normal',
        priority_index: priorityIndex,
        project_status: 'Material Procurement',
        current_stage: 'Priority Orders',
        assigned_engineer: 'Unassigned',
        expected_installation_date: null
    };
    
    const record = await createEntity('orders', payload);
    
    // Create notifications for teams
    const title = 'Order Confirmed';
    const desc = `Quotation ${record.quotationId || record.quotationNumber || 'Unknown'} has been confirmed. The project has been added to the Priority Orders queue.`;
    
    await createEntity('notifications', {
        title, desc, type: 'success', link: `/priority-orders`, read: false, createdAt: new Date().toISOString()
    });

    res.status(201).json(record);
  } catch (e) { console.error("500 ERROR CAUGHT:", e); require("fs").appendFileSync("server_errors.log", String(e.stack) + "\n"); res.status(500).json({ error: e.message }); }
});

app.put('/api/orders/reorder', requireAuth, async (req, res) => {
  try {
    const updates = req.body; // Array of { id, priorityIndex }
    const orders = await listEntities('orders');
    
    // Update each order in the JSON file
    for (const update of updates) {
        const order = orders.find(o => o.id === update.id);
        if (order) {
            order.priorityIndex = update.priorityIndex;
        }
    }
    
    // We need to write back the entire array since updateEntity is one-by-one
    for (const update of updates) {
        await updateEntity('orders', update.id, { priority_index: update.priorityIndex });
    }
    
    res.json({ ok: true });
  } catch (e) { console.error("500 ERROR CAUGHT:", e); require("fs").appendFileSync("server_errors.log", String(e.stack) + "\n"); res.status(500).json({ error: e.message }); }
});

app.put('/api/orders/:id', requireAuth, async (req, res) => {
  try {
    const dbPayload = {
      priority: req.body.priorityLevel,
      priority_index: req.body.priorityIndex, // if this column exists... wait, it doesn't? Let's check!
      order_status: req.body.currentStage || req.body.status,
      assigned_to: req.body.assignedEngineer,
      target_date: req.body.expectedInstallationDate,
      completed_date: req.body.actualCompletionDate,
      updated_at: new Date().toISOString()
    };

    // Let's enforce chk_order_status if we are mapping currentStage
    if (dbPayload.order_status) {
        const validStatuses = ['Pending', 'Priority Orders', 'Material Procurement', 'Installation Scheduled', 'Installation In Progress', 'Commissioned', 'Completed', 'Cancelled', 'On Hold', 'In Progress'];
        if (!validStatuses.includes(dbPayload.order_status)) {
            dbPayload.order_status = 'In Progress'; // Fallback
        }
    }
    
    // Clean up undefined fields
    Object.keys(dbPayload).forEach(k => dbPayload[k] === undefined && delete dbPayload[k]);

    const upd = await updateEntity('orders', req.params.id, dbPayload);
    if (!upd) return res.status(404).json({ error: 'Not found' });
    res.json(upd);
  } catch (e) { console.error("500 ERROR CAUGHT:", e); require("fs").appendFileSync("server_errors.log", String(e.stack) + "\n"); res.status(500).json({ error: e.message }); }
});

app.delete('/api/orders/:id', requireAuth, async (req, res) => {
  try {
    const removed = await deleteEntity('orders', req.params.id);
    if (!removed) return res.status(404).json({ error: 'Not found' });
    res.json({ ok: true });
  } catch (e) { console.error("500 ERROR CAUGHT:", e); require("fs").appendFileSync("server_errors.log", String(e.stack) + "\n"); res.status(500).json({ error: e.message }); }
});

// --- Invoices ---
app.get('/api/invoices', requireAuth, async (req, res) => {
  try {
    const invoices = await listForRequest('invoices', req.tenant);
    const mapped = invoices.map(i => ({
        id: i.id,
        quotationId: i.quotation_id || i.quotationId,
        customerId: i.customer_id || i.customerId,
        customerName: i.customer_name || i.customerName,
        date: i.date || i.created_at,
        dueDate: i.due_date || i.dueDate,
        subtotal: i.subtotal,
        discount: i.discount,
        totalTax: i.total_tax || i.totalTax,
        grandTotal: i.grand_total || i.grandTotal,
        total: i.grand_total || i.grandTotal, // For Reports.tsx backward compatibility
        paid: i.paid || 0,
        status: i.status,
        approval_status: i.approval_status || i.approvalStatus || 'Draft',
        createdAt: i.created_at || i.createdAt,
        items: i.items || []
    }));
    res.json(mapped);
  } catch (e) { console.error("500 ERROR CAUGHT:", e); require("fs").appendFileSync("server_errors.log", String(e.stack) + "\n"); res.status(500).json({ error: e.message }); }
});

app.get('/api/invoices/:id', async (req, res) => {
  try {
    const inv = await findEntity('invoices', req.params.id);
    if (!inv) return res.status(404).json({ error: 'Not found' });
    
    // Attach customer if available
    const custId = inv.customer_id || inv.customerId;
    if (custId) {
      const cust = await findEntity('customers', custId).catch(() => null);
      if (cust) inv.customer = cust;
    }
    
    // Attach quotation if available
    const quoId = inv.quotation_id || inv.quotationId;
    if (quoId) {
      const quo = await findEntity('quotations', quoId).catch(() => null);
      if (quo) {
        inv.quotation = quo;
        // Fallback: If invoice didn't have customer, fetch from quotation
        if (!inv.customer) {
          const qCustId = quo.customer_id || quo.customerId;
          if (qCustId) {
            const cust = await findEntity('customers', qCustId).catch(() => null);
            if (cust) inv.customer = cust;
          }
        }
      }
    }
    
    res.json(inv);
  } catch (e) { console.error("500 ERROR CAUGHT:", e); require("fs").appendFileSync("server_errors.log", String(e.stack) + "\n"); res.status(500).json({ error: e.message }); }
});

app.post('/api/invoices', requireAuth, async (req, res) => {
  try {
    const autoId = await generateNextId('invoice');
    const tp = tenantPayload(req.tenant);
    const approvalDefaults = req.tenant?.is_super_admin
      ? { approval_status: 'Approved' }
      : { approval_status: 'Draft' };
    const payload = Object.assign({ id: autoId, status: 'Pending', createdAt: new Date().toISOString() }, approvalDefaults, tp, req.body);
    const record = await createEntity('invoices', payload);
    try {
      // create simple journal + ledger entries for accounting trace
      const journalPayload = { date: new Date().toISOString(), narration: `Invoice ${record.id}`, createdAt: new Date().toISOString() };
      const journal = await createEntity('journal_entries', journalPayload);
      // Basic two-line entry: Debit AccountsReceivable, Credit Revenue
      await createEntity('ledger_entries', { journal_id: journal.id, account: 'AccountsReceivable', debit: record.total || 0, credit: 0, created_at: new Date().toISOString() });
      await createEntity('ledger_entries', { journal_id: journal.id, account: 'Revenue', debit: 0, credit: record.total || 0, created_at: new Date().toISOString() });
      try { broadcastEvent({ type: 'invoice.created', data: record }, record.organization_id || null); } catch (e) { }
    } catch (e) { console.warn('invoice accounting failed', e.message); }
    res.status(201).json(record);
  } catch (e) { console.error("500 ERROR CAUGHT:", e); require("fs").appendFileSync("server_errors.log", String(e.stack) + "\n"); res.status(500).json({ error: e.message }); }
});

app.put('/api/invoices/:id', requireAuth, async (req, res) => {
  try {
    const dbPayload = { ...req.body };
    delete dbPayload.balance;
    delete dbPayload.amount;
    delete dbPayload.created_at;
    delete dbPayload.updated_at;
    
    // Remove relations that are joined via Supabase select (not actual columns)
    delete dbPayload.customer;
    delete dbPayload.quotation;

    const upd = await updateEntity('invoices', req.params.id, dbPayload);
    if (!upd) return res.status(404).json({ error: 'Not found' });
    res.json(upd);
  } catch (e) { console.error("500 ERROR CAUGHT:", e); require("fs").appendFileSync("server_errors.log", String(e.stack) + "\n"); res.status(500).json({ error: e.message }); }
});

app.delete('/api/invoices/:id', requireAuth, async (req, res) => {
  try {
    const removed = await deleteEntity('invoices', req.params.id);
    if (!removed) return res.status(404).json({ error: 'Not found' });
    res.json({ ok: true });
  } catch (e) { console.error("500 ERROR CAUGHT:", e); require("fs").appendFileSync("server_errors.log", String(e.stack) + "\n"); res.status(500).json({ error: e.message }); }
});

// --- Payments ---
app.get('/api/payments', requireAuth, async (req, res) => {
  try {
    const payments = await listForRequest('payments', req.tenant);
    const mapped = payments.map(p => ({
        id: p.id,
        invoiceId: p.invoice_id || p.invoiceId,
        customerId: p.customer_id || p.customerId,
        customerName: p.customer_name || p.customerName,
        amount: p.amount,
        date: p.document_date || p.payment_date || p.date,
        method: p.payment_mode || p.method,
        reference: p.utr_number || p.cheque_number || p.reference,
        notes: p.remarks || p.notes,
        status: p.status,
        createdAt: p.created_at || p.createdAt
    }));
    res.json(mapped);
  } catch (e) { console.error("500 ERROR CAUGHT:", e); require("fs").appendFileSync("server_errors.log", String(e.stack) + "\n"); res.status(500).json({ error: e.message }); }
});

app.get('/api/payments/:id', async (req, res) => {
  try {
    const p = await findEntity('payments', req.params.id);
    if (!p) return res.status(404).json({ error: 'Not found' });
    res.json(p);
  } catch (e) { console.error("500 ERROR CAUGHT:", e); require("fs").appendFileSync("server_errors.log", String(e.stack) + "\n"); res.status(500).json({ error: e.message }); }
});

// expose ledger entries for tests (read-only)
app.get('/ledger_entries', async (req, res) => {
  try {
    const ledgers = await listEntities('ledger_entries');
    res.json(ledgers);
  } catch (e) { console.error("500 ERROR CAUGHT:", e); require("fs").appendFileSync("server_errors.log", String(e.stack) + "\n"); res.status(500).json({ error: e.message }); }
});

app.post('/api/payments', requireAuth, async (req, res) => {
  try {
      if (!req.body.amount || req.body.amount <= 0) {
        return res.status(400).json({ error: 'Valid amount is required' });
      }
      
      let pMode = req.body.method || 'Bank Transfer';
      if (pMode === 'Online Banking') pMode = 'Bank Transfer';
      if (pMode === 'Credit Card') pMode = 'Other';
      if (pMode.startsWith('UPI')) pMode = 'UPI';

      const dbPayload = {
        invoice_id: req.body.invoiceId || null,
        quotation_id: req.body.quotationId || null,
        amount: req.body.amount || 0,
        document_date: req.body.date || new Date().toISOString().split('T')[0],
        payment_mode: pMode,
        utr_number: req.body.reference || null,
        remarks: req.body.notes || null,
        status: 'Paid', // the constraint chk_payment_status now supports Paid
        payment_type: req.body.paymentType || 'Advance',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        customer_id: req.body.customerId || null,
        customer_name: req.body.customerName || null,
        tenant_id: req.user?.tenant_id || 'admin',
        franchise_id: req.user?.franchise_id || null
      };

      // inherit customer ID/Name if not provided but invoice exists
      if (dbPayload.invoice_id && (!dbPayload.customer_id || !dbPayload.quotation_id)) {
        const inv = await findEntity('invoices', dbPayload.invoice_id);
        if (inv) {
          dbPayload.customer_id = dbPayload.customer_id || inv.customer_id || inv.customerId;
          dbPayload.customer_name = dbPayload.customer_name || inv.customer_name || inv.customerName;
          dbPayload.quotation_id = dbPayload.quotation_id || inv.quotation_id || inv.quotationId;
        }
      } else if (dbPayload.quotation_id && !dbPayload.customer_id) {
        const quo = await findEntity('quotations', dbPayload.quotation_id);
        if (quo) {
          dbPayload.customer_id = dbPayload.customer_id || quo.customer_id || quo.customerId;
          dbPayload.customer_name = dbPayload.customer_name || quo.customer_name || quo.customerName;
        }
      }

      if (!dbPayload.invoice_id && !dbPayload.quotation_id) {
        return res.status(400).json({ error: 'Payment must be linked to an invoice or quotation' });
      }

      const record = await createEntity('payments', dbPayload);

      // update invoice paid amount if linked
      if (record.invoice_id) {
        const inv = await findEntity('invoices', record.invoice_id);
        if (inv) {
          const paid = (inv.paid || 0) + (record.amount || 0);
          let newStatus = inv.status;
          if (paid >= (inv.total || inv.grand_total || 0)) {
            newStatus = 'Paid';
          } else if (paid > 0) {
            newStatus = 'Partially Paid';
          }
          await updateEntity('invoices', inv.id, { paid, status: newStatus });
        }
      }

      // Automatically create a Priority Order if this is an advance payment for a quotation
      if (record.quotation_id) {
        const quo = await findEntity('quotations', record.quotation_id);
        if (quo) {
           const quoPaid = (quo.paid || 0) + (record.amount || 0);
           await updateEntity('quotations', quo.id, { paid: quoPaid });
           
           // Check if order already exists
           const existingOrders = await listEntities('orders');
           const orderExists = existingOrders.find(o => (o.quotation_id || o.quotationId) === record.quotation_id);
           
           if (!orderExists && quoPaid > 0) {
              const newOrder = {
                  quotation_id: quo.id,
                  customer_id: quo.customer_id || quo.customerId,
                  priority: 'Normal',
                  order_status: 'Pending',
                  tenant_id: req.user?.tenant_id || 'admin',
                  franchise_id: req.user?.franchise_id || null,
                  created_at: new Date().toISOString(),
                  updated_at: new Date().toISOString()
              };
              await createEntity('orders', newOrder);
           }
        }
      }

      // Create basic journal + ledger for payment
      try {
        const journal = await createEntity('journal_entries', { entry_date: new Date().toISOString(), narration: `Payment ${record.id}`, created_at: new Date().toISOString() });
        await createEntity('ledger_entries', { journal_id: journal.id, account: 'Cash', debit: record.amount || 0, credit: 0, created_at: new Date().toISOString() });
        await createEntity('ledger_entries', { journal_id: journal.id, account: 'AccountsReceivable', debit: 0, credit: record.amount || 0, created_at: new Date().toISOString() });
        try { broadcastEvent({ type: 'payment.created', data: record }, record.organization_id || null); } catch (e) { }
      } catch (e) { console.warn('payment accounting failed', e.message); }

      res.status(201).json(record);
  } catch (e) { 
      console.error("500 ERROR CAUGHT:", e); 
      require("fs").appendFileSync("server_errors.log", String(e.stack) + "\n"); 
      res.status(500).json({ error: e.message }); 
  }
});

app.put('/api/payments/:id', requireAuth, async (req, res) => {
  try {
    const upd = await updateEntity('payments', req.params.id, req.body);
    if (!upd) return res.status(404).json({ error: 'Not found' });
    res.json(upd);
  } catch (e) { console.error("500 ERROR CAUGHT:", e); require("fs").appendFileSync("server_errors.log", String(e.stack) + "\n"); res.status(500).json({ error: e.message }); }
});

app.delete('/api/payments/:id', requireAuth, async (req, res) => {
  try {
    const removed = await deleteEntity('payments', req.params.id);
    if (!removed) return res.status(404).json({ error: 'Not found' });
    res.json({ ok: true });
  } catch (e) { console.error("500 ERROR CAUGHT:", e); require("fs").appendFileSync("server_errors.log", String(e.stack) + "\n"); res.status(500).json({ error: e.message }); }
});

// --- AMC ---
app.get('/api/amc', requireAuth, async (req, res) => {
  try {
    let amc;
    if (req.tenant?.is_super_admin) {
      amc = await listEntities('amc');
    } else {
      amc = await supa.listByTenant('amc', req.tenant?.id, req.tenant?.franchise_id);
    }
    res.json(amc);
  } catch (e) { console.error("500 ERROR CAUGHT:", e); require("fs").appendFileSync("server_errors.log", String(e.stack) + "\n"); res.status(500).json({ error: e.message }); }
});

app.get('/api/amc/:id', async (req, res) => {
  try {
    const a = await findEntity('amc', req.params.id);
    if (!a) return res.status(404).json({ error: 'Not found' });
    res.json(a);
  } catch (e) { console.error("500 ERROR CAUGHT:", e); require("fs").appendFileSync("server_errors.log", String(e.stack) + "\n"); res.status(500).json({ error: e.message }); }
});

app.post('/api/amc', requireAuth, async (req, res) => {
  try {
    const payload = req.body;
    const record = await createEntity('amc', payload);
    try { broadcastEvent({ type: 'amc.created', data: record }, record.organization_id || null); } catch (e) { }
    res.status(201).json(record);
  } catch (e) { console.error("500 ERROR CAUGHT:", e); require("fs").appendFileSync("server_errors.log", String(e.stack) + "\n"); res.status(500).json({ error: e.message }); }
});

app.put('/api/amc/:id', requireAuth, async (req, res) => {
  try {
    const upd = await updateEntity('amc', req.params.id, req.body);
    if (!upd) return res.status(404).json({ error: 'Not found' });
    res.json(upd);
  } catch (e) { console.error("500 ERROR CAUGHT:", e); require("fs").appendFileSync("server_errors.log", String(e.stack) + "\n"); res.status(500).json({ error: e.message }); }
});

app.delete('/api/amc/:id', requireAuth, async (req, res) => {
  try {
    const removed = await deleteEntity('amc', req.params.id);
    if (!removed) return res.status(404).json({ error: 'Not found' });
    res.json({ ok: true });
  } catch (e) { console.error("500 ERROR CAUGHT:", e); require("fs").appendFileSync("server_errors.log", String(e.stack) + "\n"); res.status(500).json({ error: e.message }); }
});

// --- Notifications ---
async function checkAndGenerateNotifications() {
  if (checkAndGenerateNotifications._busy) return;
  if (checkAndGenerateNotifications._lastRun && Date.now() - checkAndGenerateNotifications._lastRun < 60000) return;
  checkAndGenerateNotifications._busy = true;
  try {
    checkAndGenerateNotifications._lastRun = Date.now();
    const notifications = await listEntities('notifications');
    const invoices = await listEntities('invoices');
    const quotations = await listEntities('quotations');
    const products = await listEntities('products');
    const amc = await listEntities('amc');

    const newNotifs = [];
    const now = new Date();

    // Check Invoices (overdue)
    for (const inv of invoices) {
      if (inv.status !== 'Paid' && inv.dueDate) {
        const due = new Date(inv.dueDate);
        const diffTime = now.getTime() - due.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        if (diffDays > 0) {
          const title = 'Invoice Overdue';
          const desc = `Invoice ${inv.id} is overdue by ${diffDays} days`;
          if (!notifications.some(n => n.title === title && n.desc.includes(inv.id))) {
            newNotifs.push({ title, desc, type: 'danger', link: `/view-invoice/${inv.id}`, read: false, createdAt: now.toISOString() });
          }
        } else if (diffDays >= -2 && diffDays <= 0) {
          const title = 'Invoice Due Soon';
          const desc = `Invoice ${inv.id} is due in ${Math.abs(diffDays)} days`;
          if (!notifications.some(n => n.title === title && n.desc.includes(inv.id))) {
            newNotifs.push({ title, desc, type: 'warning', link: `/view-invoice/${inv.id}`, read: false, createdAt: now.toISOString() });
          }
        }
      }
    }

    // Check Inventory (low stock)
    for (const prod of products) {
      const stock = Number(prod.stock || 0);
      const minStock = Number(prod.minStock || 5);
      if (stock <= minStock && stock > 0) {
        const title = 'Low Stock Alert';
        const desc = `Low stock: ${prod.name} (${stock} remaining)`;
        if (!notifications.some(n => n.desc === desc && !n.read)) {
          newNotifs.push({ title, desc, type: 'warning', link: `/products`, read: false, createdAt: now.toISOString() });
        }
      } else if (stock === 0) {
        const title = 'Out of Stock Alert';
        const desc = `${prod.name} stock is empty`;
        if (!notifications.some(n => n.desc === desc && !n.read)) {
          newNotifs.push({ title, desc, type: 'danger', link: `/products`, read: false, createdAt: now.toISOString() });
        }
      }
    }

    // Check Quotations (expiring)
    for (const q of quotations) {
      if (q.status !== 'Invoiced' && q.validUntil) {
        const valid = new Date(q.validUntil);
        const diffDays = Math.ceil((valid.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        if (diffDays >= 0 && diffDays <= 3) {
          const title = 'Quotation Expiring';
          const desc = `Quotation ${q.id} expires in ${diffDays} days`;
          if (!notifications.some(n => n.desc.includes(`Quotation ${q.id} expires`))) {
            newNotifs.push({ title, desc, type: 'warning', link: `/view-quotation/${q.id}`, read: false, createdAt: now.toISOString() });
          }
        }
      }
    }

    // Check AMC (expiring)
    for (const a of amc) {
      if (a.endDate) {
        const end = new Date(a.endDate);
        const diffDays = Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        if (diffDays >= 0 && diffDays <= 14) {
          const title = 'AMC Contract Expiring';
          const desc = `AMC contract for ${a.customerName || 'customer'} expires in ${diffDays} days`;
          if (!notifications.some(n => n.desc.includes(`AMC contract for ${a.customerName || 'customer'}`))) {
            newNotifs.push({ title, desc, type: 'warning', link: `/amc`, read: false, createdAt: now.toISOString() });
          }
        }
      }
    }

    for (const n of newNotifs) {
      await createEntity('notifications', n);
    }
  } catch (e) {
    console.error('generateNotifs error', e);
  } finally {
    checkAndGenerateNotifications._busy = false;
  }
}

app.get('/api/notifications', async (req, res) => {
  try {
    const notifications = await listEntities('notifications');
    notifications.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
    res.json(notifications);
    if (notifications.length >= 0) {
      setImmediate(() => { checkAndGenerateNotifications().catch(() => {}); });
    }
  } catch (e) {
    console.warn('[notifications]', e.message);
    res.json([]);
  }
});

app.post('/api/notifications', requireAuth, async (req, res) => {
  try {
    const payload = Object.assign({ createdAt: new Date().toISOString(), read: false }, req.body);
    const nt = await createEntity('notifications', payload);
    res.status(201).json(nt);
  } catch (e) { console.error("500 ERROR CAUGHT:", e); require("fs").appendFileSync("server_errors.log", String(e.stack) + "\n"); res.status(500).json({ error: e.message }); }
});

app.put('/api/notifications/read/:id', requireAuth, async (req, res) => {
  try {
    const upd = await updateEntity('notifications', req.params.id, { read: true });
    if (!upd) return res.status(404).json({ error: 'Not found' });
    res.json(upd);
  } catch (e) { console.error("500 ERROR CAUGHT:", e); require("fs").appendFileSync("server_errors.log", String(e.stack) + "\n"); res.status(500).json({ error: e.message }); }
});

app.put('/api/notifications/read-all', requireAuth, async (req, res) => {
  try {
    const notifications = await listEntities('notifications');
    let count = 0;
    for (const n of notifications) {
      if (!n.read) {
        await updateEntity('notifications', n.id, { read: true });
        count++;
      }
    }
    res.json({ ok: true, count });
  } catch (e) { console.error("500 ERROR CAUGHT:", e); require("fs").appendFileSync("server_errors.log", String(e.stack) + "\n"); res.status(500).json({ error: e.message }); }
});
app.get('/api/reports/summary', async (req, res) => {
  try {
    const invoices = await listEntities('invoices');
    const payments = await listEntities('payments');
    const revenue = (invoices || []).reduce((s, i) => s + (i.total || 0), 0);
    const received = (payments || []).reduce((s, p) => s + (p.amount || 0), 0);
    const pending = revenue - received;
    res.json({ revenue, received, pending });
  } catch (e) { console.error("500 ERROR CAUGHT:", e); require("fs").appendFileSync("server_errors.log", String(e.stack) + "\n"); res.status(500).json({ error: e.message }); }
});

// --- Settings ---
app.get('/api/settings', async (req, res) => {
  try {
    const settingsList = await listEntities('settings');
    const globalSettings = settingsList.find(s => s.id === 'global') || { id: 'global', global_settings: {} };
    res.json(globalSettings);
  } catch (e) {
    // If settings table query fails, return safe defaults so frontend doesn't break
    console.warn('[SETTINGS] Failed to load settings:', e.message);
    res.json({ id: 'global', global_settings: {} });
  }
});

app.put('/api/settings', requireAuth, async (req, res) => {
  try {
    // Enforce settings lock for franchise users
    const { cleaned: payload, blockedKeys } = enforceSettingsLock(req.body, req.tenant);
    if (blockedKeys.length > 0 && !req.tenant?.is_super_admin) {
      console.warn(`[Settings] Franchise user ${req.tenant?.username} tried to modify locked fields:`, blockedKeys);
    }
    const settingsList = await listEntities('settings');
    let upd;
    if (settingsList.find(s => s.id === 'global')) {
      upd = await updateEntity('settings', 'global', { global_settings: payload });
    } else {
      upd = await createEntity('settings', { id: 'global', global_settings: payload });
    }

    // Broadcast setting change so connected clients can update UI immediately
    try { broadcastEvent({ type: 'settings.updated', data: upd.global_settings }); } catch (e) { }

    res.json(upd);
  } catch (e) {
    console.warn('[SETTINGS] save failed:', e.message);
    res.json({ id: 'global', global_settings: req.body || {} });
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// ── FRANCHISE MANAGEMENT APIs (Super Admin only) ───────────────────────────
// ══════════════════════════════════════════════════════════════════════════════

// GET /api/franchises — list all franchises
app.get('/api/franchises', requireAuth, async (req, res) => {
  if (!req.tenant?.is_super_admin) return res.status(403).json({ error: 'Super Admin only' });
  try {
    const data = await listEntities('franchises');
    res.json(data || []);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/franchises — create a franchise
app.post('/api/franchises', requireAuth, async (req, res) => {
  if (!req.tenant?.is_super_admin) return res.status(403).json({ error: 'Super Admin only' });
  try {
    let fr = null;
    if (supabaseOnline()) {
      try { fr = await supa.createFranchise(req.body, req.tenant.username); } catch (e) { console.warn('supa.createFranchise failed', e.message); }
    }
    if (!fr) {
      const franchiseId = req.body.id || 'FR-' + Date.now();
      const franchise = {
        id:               franchiseId,
        franchise_code:   franchiseId,
        name:             req.body.name,
        city:             req.body.city || null,
        state:            req.body.state || null,
        admin_name:       req.body.adminName || null,
        admin_email:      req.body.adminEmail || null,
        admin_phone:      req.body.adminPhone || null,
        branch_address:   req.body.branchAddress || null,
        status:           'Active',
        created_by:       req.tenant?.username || 'super_admin',
      };
      fr = await createEntity('franchises', franchise);
      
      const settingsList = await readDataFile('settings.json');
      settingsList.push({
        id: franchiseId,
        franchise_id: franchiseId,
        branch_address: req.body.branchAddress || null,
      });
      await writeDataFile('settings.json', settingsList);
    }
    if (!fr) return res.status(500).json({ error: 'Failed to create franchise' });

    // Create the franchise admin user account
    const { username, password, adminEmail, adminName } = req.body;
    if (username && password) {
      const hash = await bcrypt.hash(password, 10);
      await createEntity('users', {
        username:     username || adminEmail,
        password:     hash,
        role:         'franchise_admin',
        tenant_id:    fr.id,
        franchise_id: fr.id,
        is_active:    true,
      });
    }

    await supa.writeAuditLog({ action: 'create_franchise', entity_type: 'franchise', entity_id: fr.id, performed_by: req.tenant.username, ip_address: req.ip });
    res.status(201).json(fr);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// PUT /api/franchises/:id — edit a franchise
app.put('/api/franchises/:id', requireAuth, async (req, res) => {
  if (!req.tenant?.is_super_admin) return res.status(403).json({ error: 'Super Admin only' });
  try {
    const upd = await updateEntity('franchises', req.params.id, req.body);
    if (!upd) return res.status(404).json({ error: 'Franchise not found' });
    await supa.writeAuditLog({ action: 'update_franchise', entity_type: 'franchise', entity_id: req.params.id, performed_by: req.tenant.username, ip_address: req.ip });
    res.json(upd);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/franchises/:id/suspend
app.post('/api/franchises/:id/suspend', requireAuth, async (req, res) => {
  if (!req.tenant?.is_super_admin) return res.status(403).json({ error: 'Super Admin only' });
  try {
    const upd = await updateEntity('franchises', req.params.id, { status: 'Suspended' });
    if (!upd) return res.status(404).json({ error: 'Franchise not found' });
    await supa.writeAuditLog({ action: 'suspend_franchise', entity_type: 'franchise', entity_id: req.params.id, performed_by: req.tenant.username, ip_address: req.ip });
    res.json({ ok: true, status: 'Suspended' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/franchises/:id/activate
app.post('/api/franchises/:id/activate', requireAuth, async (req, res) => {
  if (!req.tenant?.is_super_admin) return res.status(403).json({ error: 'Super Admin only' });
  try {
    const upd = await updateEntity('franchises', req.params.id, { status: 'Active' });
    if (!upd) return res.status(404).json({ error: 'Franchise not found' });
    await supa.writeAuditLog({ action: 'activate_franchise', entity_type: 'franchise', entity_id: req.params.id, performed_by: req.tenant.username, ip_address: req.ip });
    res.json({ ok: true, status: 'Active' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/franchises/:id/reset-password
app.post('/api/franchises/:id/reset-password', requireAuth, async (req, res) => {
  if (!req.tenant?.is_super_admin) return res.status(403).json({ error: 'Super Admin only' });
  try {
    const { newPassword } = req.body;
    if (!newPassword) return res.status(400).json({ error: 'newPassword is required' });
    const hash = await bcrypt.hash(newPassword, 10);
    // Find user by franchise_id
    const users = await listEntities('users');
    const frUser = users.find(u => u.franchise_id === req.params.id);
    if (!frUser) return res.status(404).json({ error: 'Franchise user not found' });
    await updateEntity('users', frUser.id, { password: hash });
    await supa.writeAuditLog({ action: 'reset_password', entity_type: 'franchise', entity_id: req.params.id, performed_by: req.tenant.username, ip_address: req.ip });
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/franchises/:id/dashboard — single franchise KPIs
app.get('/api/franchises/:id/dashboard', requireAuth, async (req, res) => {
  if (!req.tenant?.is_super_admin) return res.status(403).json({ error: 'Super Admin only' });
  try {
    let data = null;
    if (supabaseOnline()) { try { data = await supa.getFranchiseDashboard(req.params.id); } catch(e){} }
    if (!data) data = { franchise_id: req.params.id, total_customers: 0, total_quotations: 0, total_invoices: 0, total_revenue: 0, outstanding: 0, pending_approvals: 0 };
    res.json(data);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/super-admin/dashboard — global aggregate
app.get('/api/super-admin/dashboard', requireAuth, async (req, res) => {
  if (!req.tenant?.is_super_admin) return res.status(403).json({ error: 'Super Admin only' });
  try {
    let data = null;
    if (supabaseOnline()) { try { data = await supa.getSuperAdminDashboard(); } catch(e){} }
    if (!data) data = { total_franchises: 0, active_franchises: 0, total_revenue: 0, mrr: 0, active_users: 0, recent_franchises: [] };
    res.json(data);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ══════════════════════════════════════════════════════════════════════════════
// ── APPROVAL APIs ──────────────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════════

// GET /api/approvals/pending — all pending approvals (Super Admin)
app.get('/api/approvals/pending', requireAuth, async (req, res) => {
  if (!req.tenant?.is_super_admin) return res.status(403).json({ error: 'Super Admin only' });
  try {
    let data = null;
    if (supabaseOnline()) { try { data = await supa.getPendingApprovals(); } catch(e){} }
    res.json(data || { quotations: [], invoices: [], total: 0 });
  } catch (e) {
    console.warn('[approvals]', e.message);
    res.json({ quotations: [], invoices: [], total: 0 });
  }
});

// POST /api/quotations/:id/submit — franchise submits for approval
app.post('/api/quotations/:id/submit', requireAuth, async (req, res) => {
  try {
    const q = await findEntity('quotations', req.params.id);
    if (!q) return res.status(404).json({ error: 'Quotation not found' });
    // Franchise users can only submit their own quotations
    if (!req.tenant?.is_super_admin && q.franchise_id !== req.tenant?.franchise_id) {
      return res.status(403).json({ error: 'Access denied' });
    }
    if (q.approval_status === 'Approved') return res.status(400).json({ error: 'Quotation is already approved' });
    const old = q.approval_status;
    const upd = await updateEntity('quotations', req.params.id, { approval_status: 'Submitted', submitted_at: new Date().toISOString() });
    try { await supa.writeApprovalLog({ entityType: 'quotation', entityId: req.params.id, franchiseId: q.franchise_id, tenantId: q.tenant_id, action: 'submitted', performedBy: req.tenant.username, performedRole: req.tenant.role, oldStatus: old, newStatus: 'Submitted', ipAddress: req.ip }); } catch(e) {}
    // Notify Super Admin
    await createEntity('notifications', { title: 'Quotation Submitted for Approval', desc: `Franchise submitted quotation ${req.params.id} for approval`, type: 'info', link: `/approvals`, read: false, target_role: 'super_admin', createdAt: new Date().toISOString() });
    res.json(upd);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/quotations/:id/approve — Super Admin approves
app.post('/api/quotations/:id/approve', requireAuth, async (req, res) => {
  if (!req.tenant?.is_super_admin) return res.status(403).json({ error: 'Super Admin only' });
  try {
    const q = await findEntity('quotations', req.params.id);
    if (!q) return res.status(404).json({ error: 'Not found' });
    const old = q.approval_status;
    const upd = await updateEntity('quotations', req.params.id, { approval_status: 'Approved', approved_by: req.tenant.username, approved_at: new Date().toISOString(), rejection_reason: null });
    try { await supa.writeApprovalLog({ entityType: 'quotation', entityId: req.params.id, franchiseId: q.franchise_id, tenantId: q.tenant_id, action: 'approved', performedBy: req.tenant.username, performedRole: req.tenant.role, oldStatus: old, newStatus: 'Approved', ipAddress: req.ip }); } catch(e) {}
    await createEntity('notifications', { title: 'Quotation Approved', desc: `Your quotation ${req.params.id} has been approved by Head Office`, type: 'success', link: `/view-quotation/${req.params.id}`, read: false, tenant_id: q.tenant_id, franchise_id: q.franchise_id, createdAt: new Date().toISOString() });
    try { broadcastEvent({ type: 'quotation.approved', data: { id: req.params.id } }); } catch(e) {}
    res.json(upd);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/quotations/:id/reject — Super Admin rejects
app.post('/api/quotations/:id/reject', requireAuth, async (req, res) => {
  if (!req.tenant?.is_super_admin) return res.status(403).json({ error: 'Super Admin only' });
  try {
    const { reason } = req.body;
    if (!reason) return res.status(400).json({ error: 'Rejection reason is required' });
    const q = await findEntity('quotations', req.params.id);
    if (!q) return res.status(404).json({ error: 'Not found' });
    const old = q.approval_status;
    const upd = await updateEntity('quotations', req.params.id, { approval_status: 'Rejected', approved_by: req.tenant.username, approved_at: new Date().toISOString(), rejection_reason: reason });
    try { await supa.writeApprovalLog({ entityType: 'quotation', entityId: req.params.id, franchiseId: q.franchise_id, tenantId: q.tenant_id, action: 'rejected', performedBy: req.tenant.username, performedRole: req.tenant.role, comment: reason, oldStatus: old, newStatus: 'Rejected', ipAddress: req.ip }); } catch(e) {}
    await createEntity('notifications', { title: 'Quotation Rejected', desc: `Your quotation ${req.params.id} was rejected. Reason: ${reason}`, type: 'danger', link: `/view-quotation/${req.params.id}`, read: false, tenant_id: q.tenant_id, franchise_id: q.franchise_id, createdAt: new Date().toISOString() });
    try { broadcastEvent({ type: 'quotation.rejected', data: { id: req.params.id, reason } }); } catch(e) {}
    res.json(upd);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/quotations/:id/request-changes
app.post('/api/quotations/:id/request-changes', requireAuth, async (req, res) => {
  if (!req.tenant?.is_super_admin) return res.status(403).json({ error: 'Super Admin only' });
  try {
    const { comment } = req.body;
    const q = await findEntity('quotations', req.params.id);
    if (!q) return res.status(404).json({ error: 'Not found' });
    const old = q.approval_status;
    const upd = await updateEntity('quotations', req.params.id, { approval_status: 'Revision Requested', rejection_reason: comment || '' });
    try { await supa.writeApprovalLog({ entityType: 'quotation', entityId: req.params.id, franchiseId: q.franchise_id, tenantId: q.tenant_id, action: 'revision_requested', performedBy: req.tenant.username, performedRole: req.tenant.role, comment, oldStatus: old, newStatus: 'Revision Requested', ipAddress: req.ip }); } catch(e) {}
    await createEntity('notifications', { title: 'Quotation Revision Requested', desc: `Head Office requested changes on quotation ${req.params.id}: ${comment || ''}`, type: 'warning', link: `/view-quotation/${req.params.id}`, read: false, tenant_id: q.tenant_id, franchise_id: q.franchise_id, createdAt: new Date().toISOString() });
    res.json(upd);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/invoices/:id/submit
app.post('/api/invoices/:id/submit', requireAuth, async (req, res) => {
  try {
    const inv = await findEntity('invoices', req.params.id);
    if (!inv) return res.status(404).json({ error: 'Invoice not found' });
    if (!req.tenant?.is_super_admin && inv.franchise_id !== req.tenant?.franchise_id) {
      return res.status(403).json({ error: 'Access denied' });
    }
    if (inv.approval_status === 'Approved') return res.status(400).json({ error: 'Already approved' });
    const old = inv.approval_status;
    const upd = await updateEntity('invoices', req.params.id, { approval_status: 'Submitted', submitted_at: new Date().toISOString() });
    try { await supa.writeApprovalLog({ entityType: 'invoice', entityId: req.params.id, franchiseId: inv.franchise_id, tenantId: inv.tenant_id, action: 'submitted', performedBy: req.tenant.username, performedRole: req.tenant.role, oldStatus: old, newStatus: 'Submitted', ipAddress: req.ip }); } catch(e) {}
    await createEntity('notifications', { title: 'Invoice Submitted for Approval', desc: `Franchise submitted invoice ${req.params.id} for approval`, type: 'info', link: `/approvals`, read: false, target_role: 'super_admin', createdAt: new Date().toISOString() });
    res.json(upd);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/invoices/:id/approve
app.post('/api/invoices/:id/approve', requireAuth, async (req, res) => {
  if (!req.tenant?.is_super_admin) return res.status(403).json({ error: 'Super Admin only' });
  try {
    const inv = await findEntity('invoices', req.params.id);
    if (!inv) return res.status(404).json({ error: 'Not found' });
    const old = inv.approval_status;
    const upd = await updateEntity('invoices', req.params.id, { approval_status: 'Approved', approved_by: req.tenant.username, approved_at: new Date().toISOString() });
    try { await supa.writeApprovalLog({ entityType: 'invoice', entityId: req.params.id, franchiseId: inv.franchise_id, tenantId: inv.tenant_id, action: 'approved', performedBy: req.tenant.username, performedRole: req.tenant.role, oldStatus: old, newStatus: 'Approved', ipAddress: req.ip }); } catch(e) {}
    await createEntity('notifications', { title: 'Invoice Approved', desc: `Your invoice ${req.params.id} has been approved by Head Office`, type: 'success', link: `/invoices/${req.params.id}`, read: false, tenant_id: inv.tenant_id, franchise_id: inv.franchise_id, createdAt: new Date().toISOString() });
    try { broadcastEvent({ type: 'invoice.approved', data: { id: req.params.id } }); } catch(e) {}
    res.json(upd);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/invoices/:id/reject
app.post('/api/invoices/:id/reject', requireAuth, async (req, res) => {
  if (!req.tenant?.is_super_admin) return res.status(403).json({ error: 'Super Admin only' });
  try {
    const { reason } = req.body;
    if (!reason) return res.status(400).json({ error: 'Rejection reason is required' });
    const inv = await findEntity('invoices', req.params.id);
    if (!inv) return res.status(404).json({ error: 'Not found' });
    const old = inv.approval_status;
    const upd = await updateEntity('invoices', req.params.id, { approval_status: 'Rejected', approved_by: req.tenant.username, approved_at: new Date().toISOString(), rejection_reason: reason });
    try { await supa.writeApprovalLog({ entityType: 'invoice', entityId: req.params.id, franchiseId: inv.franchise_id, tenantId: inv.tenant_id, action: 'rejected', performedBy: req.tenant.username, performedRole: req.tenant.role, comment: reason, oldStatus: old, newStatus: 'Rejected', ipAddress: req.ip }); } catch(e) {}
    await createEntity('notifications', { title: 'Invoice Rejected', desc: `Your invoice ${req.params.id} was rejected. Reason: ${reason}`, type: 'danger', link: `/invoices/${req.params.id}`, read: false, tenant_id: inv.tenant_id, franchise_id: inv.franchise_id, createdAt: new Date().toISOString() });
    res.json(upd);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── Tenant Settings (franchise editable) ─────────────────────────────────────
// GET /api/tenant/settings
app.get('/api/tenant/settings', requireAuth, async (req, res) => {
  try {
    if (req.tenant?.is_super_admin) return res.json({});
    let settings = null;
    if (supabaseOnline()) { try { settings = await supa.getTenantSettings(req.tenant.franchise_id); } catch(e){} }
    if (!settings) {
      const allSettings = await listEntities('settings');
      settings = allSettings.find(s => s.franchise_id === req.tenant.franchise_id) || {};
    }
    res.json(settings);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// PUT /api/tenant/settings
app.put('/api/tenant/settings', requireAuth, async (req, res) => {
  if (req.tenant?.is_super_admin) return res.status(400).json({ error: 'Super Admin should use /api/settings' });
  try {
    const allowed = ['branch_address', 'local_office_address', 'contact_number', 'email', 'working_hours'];
    // Only allow bank fields if franchise has bank_account_permitted
    let fr = null;
    try {
      const franchises = await listEntities('franchises');
      fr = franchises.find(f => f.id === req.tenant.franchise_id);
    } catch(e) {}
    if (fr?.bank_account_permitted) {
      allowed.push('bank_account_name', 'bank_account_number', 'bank_ifsc', 'bank_name');
    }
    const cleaned = {};
    for (const k of allowed) { if (k in req.body) cleaned[k] = req.body[k]; }
    const settings = await supa.upsertTenantSettings(req.tenant.franchise_id, cleaned, req.tenant.username);
    res.json(settings);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── RBAC Permissions (frontend uses this to build UI) ───────────────────────
app.get('/api/rbac/permissions', requireAuth, async (req, res) => {
  const role = req.tenant?.role || req.user?.role || 'franchise_admin';
  res.json(getPermissionsForRole(role));
});

// Create HTTP server and attach websockets
const server = http.createServer(app);

// Start server
// Catch-all to serve React's index.html for non-API routes (supports client-side routing)
app.get('*', (req, res) => {
  if (req.path.startsWith('/api') || req.path.startsWith('/spring')) {
    return res.status(404).json({ error: 'Not found' });
  }
  res.sendFile(path.join(__dirname, 'frontend/dist/index.html'));
});

server.listen(PORT, '0.0.0.0', async () => {
  console.log('');
  console.log(`Node API listening on port ${PORT}`);

  const hasUrl = !!process.env.SUPABASE_URL;
  const hasKey = !!(process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_KEY);
  const requireDb = process.env.REQUIRE_DATABASE !== 'false';

  if (!hasUrl || !hasKey) {
    if (!hasUrl) console.log('❌ Missing SUPABASE_URL');
    if (!hasKey) console.log('❌ Missing SUPABASE_SERVICE_KEY / SUPABASE_KEY');
    if (requireDb) {
      process.exit(1);
    }
    console.log('⚠️  Continuing without Supabase (CI smoke / local health checks only)');
    return;
  }

  const dbUrl = process.env.DATABASE_URL;
  const looksLikeLocalDockerDb = !dbUrl || dbUrl.includes('postgres:postgres@db:5432') || dbUrl.includes('postgres:password@db:');
  if (looksLikeLocalDockerDb) {
    console.log('ℹ️  DATABASE_URL not set to Supabase Postgres. Skipping SQL schema bootstrap.');
    console.log('   REST access via SUPABASE_URL/SUPABASE_KEY remains active.');
    return;
  }

  const poolConfig = { connectionString: dbUrl, ssl: { rejectUnauthorized: false } };
  const pool = new Pool(poolConfig);
  
  try {
    const client = await pool.connect();
    
    // Step 1 - Database Verification
    const { rows: [{ current_database }] } = await client.query('SELECT current_database();');
    const { rows: [{ current_schema }] } = await client.query('SELECT current_schema();');
    
    let { rows: tables } = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema='public' 
      ORDER BY table_name;
    `);

    // Step 2 & 3 - Automatic Schema Initialization
    if (tables.length === 0) {
      console.log('Database schema not initialized. Running the initialization process...\n');
      const schemaSql = fs.readFileSync(path.join(__dirname, 'scripts', 'master_schema_v3.sql'), 'utf-8');
      
      try {
        await client.query(schemaSql);
      } catch (err) {
        console.log('====================================');
        console.log('DATABASE INITIALIZATION FAILED');
        console.log('====================================');
        console.log(`Error:\n${err.message}`);
        console.log('====================================\n');
        process.exit(1);
      }
      // Step 4 - Verify Table Creation
      const { rows: finalTables } = await client.query(`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema='public' 
        ORDER BY table_name;
      `);
      tables = finalTables;
      
      // Step 5 - Verify CRUD
      console.log('\n--- Running CRUD Verification ---');
      const testCode = `TEST-${Date.now()}`;
      
      console.log('Create Customer');
      const { rows: created } = await client.query(`INSERT INTO customers (customer_code, name, email, phone) VALUES ($1, $2, $3, $4) RETURNING id`, [testCode, '{"firstName": "Test"}', 'test@test.com', '123']);
      if (!created.length) throw new Error('Create failed');
      console.log('SUCCESS');

      console.log('Read Customer');
      const { rows: read } = await client.query(`SELECT id FROM customers WHERE customer_code = $1`, [testCode]);
      if (!read.length) throw new Error('Read failed');
      console.log('SUCCESS');

      console.log('Update Customer');
      await client.query(`UPDATE customers SET email = 'updated@test.com' WHERE customer_code = $1`, [testCode]);
      console.log('SUCCESS');

      console.log('Delete Customer');
      await client.query(`DELETE FROM customers WHERE customer_code = $1`, [testCode]);
      console.log('SUCCESS');
    }

    // Storage Test
    let storagePassed = false;
    let bucketName = SupabaseStorageService.BUCKET_NAME || 'Not Configured';
    try {
      if (SupabaseStorageService.isStorageConfigured()) {
         storagePassed = await SupabaseStorageService.testConnection().then(res => res.ok);
      }
    } catch (e) {}

    // Step 7 - Backend Startup Print
    console.log('\n═══════════════════════════════════════');
    console.log('TheVoltaura ERP Startup');
    console.log('═══════════════════════════════════════');
    console.log('Database Provider\nSupabase PostgreSQL\n');
    console.log('Storage Provider\nSupabase Storage\n');
    console.log('Fallback\nDisabled');
    console.log('═══════════════════════════════════════\n');
    
    client.release();
  } catch (err) {
    console.log('\n====================================');
    console.log('DATABASE INITIALIZATION FAILED');
    console.log('====================================');
    console.log(`Error:\n${err.message}`);
    console.log('====================================\n');
    process.exit(1);
  }
});

// Initialize WebSocket server and tenant-aware broadcasting

try {
  const { WebSocketServer } = require('ws');
  wss = new WebSocketServer({ server });
  wss.on('connection', (socket, req) => {
    // Parse token from query string (?token=...)
    let orgId = null;
    try {
      const url = new URL(req.url, `http://${req.headers.host}`);
      const token = url.searchParams.get('token');
      if (token) {
        if (token === DEMO_TOKEN) {
          orgId = 'org-1'; // demo default org
        } else {
          try {
            const payload = jwt.verify(token, JWT_SECRET);
            orgId = payload.organization_id || payload.org || null;
          } catch (e) {
            // invalid token
          }
        }
      }
    } catch (e) {
      // ignore
    }
    socket.orgId = orgId;
    console.log('WebSocket client connected', orgId);
    socket.send(JSON.stringify({ type: 'hello', message: 'connected', organization: orgId }));
  });

  function broadcastEvent(event, organizationId = null) {
    if (!wss) return;
    const msg = JSON.stringify(event);
    wss.clients.forEach((client) => {
      if (client.readyState !== 1) return;
      if (organizationId) {
        if (client.orgId && client.orgId === organizationId) client.send(msg);
      } else {
        client.send(msg);
      }
    });
  }

  // Export broadcast for other parts (if needed)
  module.exports.broadcastEvent = broadcastEvent;
} catch (e) {
  console.warn('ws not available:', e.message);
}
 
 
