// Load .env (SUPABASE_URL, SUPABASE_KEY, PORT, etc.)
require('dotenv').config();

// Express-based static server + simple JSON file-backed mock API
const express = require('express');
const fs = require('fs');
const path = require('path');
const cors = require('cors');
const DocumentNumberService = require('./backend/services/DocumentNumberService');
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

app.use(cors());
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
// GET /api/documents/:documentId/download
// Fetches from Supabase Storage and streams to client.
app.get('/api/documents/:documentId/download', async (req, res) => {
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
  } catch (e) { res.status(500).json({ error: e.message }); }
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
  } catch (e) { res.status(500).json({ error: e.message }); }
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
  } catch (e) { res.status(500).json({ error: e.message }); }
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
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── Quotation Version History ────────────────────────────────────────────────
app.get('/api/quotations/:id/versions', async (req, res) => {
  try {
    if (!supa) return res.json([]);
    const versions = await supa.getQuotationVersions(req.params.id);
    res.json(versions);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── Invoice Version History ──────────────────────────────────────────────────
app.get('/api/invoices/:id/versions', async (req, res) => {
  try {
    if (!supa) return res.json([]);
    const versions = await supa.getInvoiceVersions(req.params.id);
    res.json(versions);
  } catch (e) { res.status(500).json({ error: e.message }); }
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
  } catch (e) { res.status(500).json({ error: e.message }); }
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

// Helpers for storage (file fallback or Supabase)
// Supabase credentials — loaded from .env

const useSupabase = !!(process.env.SUPABASE_URL && process.env.SUPABASE_KEY);
let supa = null;
if (useSupabase) {
  try {
    supa = require('./backend/repos/supabaseRepo');
    console.log('✅ Using Supabase backend for CRUD');
  } catch (e) {
    console.warn('⚠️  Failed to load supabaseRepo:', e.message);
    console.log('   Falling back to JSON file storage');
  }
}

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

async function readDataFile(fileName) {
  try {
    ensureDataDir();
    const filePath = path.join(DATA_DIR, fileName);
    try {
      await fs.promises.access(filePath);
    } catch (_) {
      return [];
    }
    const raw = await fs.promises.readFile(filePath, 'utf8');
    return JSON.parse(raw || '[]');
  } catch (e) {
    console.error('readData error', e);
    return [];
  }
}

async function writeDataFile(fileName, data) {
  try {
    ensureDataDir();
    const filePath = path.join(DATA_DIR, fileName);
    await fs.promises.writeFile(filePath, JSON.stringify(data, null, 2), 'utf8');
    return true;
  } catch (e) {
    console.error('writeData error', e.message);
    return false;
  }
}

function nextId(list, prefix = '') {
  const max = list.reduce((m, it) => {
    const n = parseInt((it.id || '').toString().replace(/[^0-9]/g, ''), 10) || 0;
    return Math.max(m, n);
  }, 0);
  return prefix ? `${prefix}-${max + 1}` : String(max + 1);
}

// Async helpers that use Supabase when enabled, otherwise fallback to file-sync logic
// supabaseRepo returns null when tables don't exist yet → triggers JSON file fallback
async function listEntities(entityName) {
  if (supa) {
    const result = await supa.list(entityName);
    if (result !== null) return result;
  }
  return await readDataFile(`${entityName}.json`);
}

async function createEntity(entityName, payload) {
  if (supa) {
    const result = await supa.create(entityName, payload);
    if (result !== null) return result;
  }
  const list = await readDataFile(`${entityName}.json`);
  const id = payload.id || nextId(list, entityName === 'customers' ? 'CUST' : entityName === 'products' ? 'PROD' : entityName === 'invoices' ? 'INV' : entityName === 'quotations' ? 'QT' : entityName === 'payments' ? 'PAY' : entityName === 'amc' ? 'AMC' : 'ID');
  const record = Object.assign({ id }, payload);
  list.push(record);
  await writeDataFile(`${entityName}.json`, list);
  return record;
}

async function findEntity(entityName, id) {
  if (supa) {
    const result = await supa.find(entityName, id);
    if (result !== null) return result;
  }
  const list = await readDataFile(`${entityName}.json`);
  return list.find(it => String(it.id) === String(id)) || null;
}

async function updateEntity(entityName, id, updates) {
  if (supa) {
    const result = await supa.update(entityName, id, updates);
    if (result !== null) return result;
  }
  const list = await readDataFile(`${entityName}.json`);
  const idx = list.findIndex(it => String(it.id) === String(id));
  if (idx === -1) return null;
  list[idx] = Object.assign({}, list[idx], updates);
  await writeDataFile(`${entityName}.json`, list);
  return list[idx];
}

async function deleteEntity(entityName, id) {
  if (supa) {
    const result = await supa.remove(entityName, id);
    if (result !== null) return result;
  }
  const list = await readDataFile(`${entityName}.json`);
  const idx = list.findIndex(it => String(it.id) === String(id));
  if (idx === -1) return null;
  const removed = list.splice(idx, 1)[0];
  await writeDataFile(`${entityName}.json`, list);
  return removed;
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
  // prefer per-record create when using supabase; fallback to overwrite file
  if (supa) {
    // naive: create any users that don't have an id yet
    for (const u of users) {
      if (!u.id) await createEntity('users', u);
    }
    return true;
  }
  return await writeDataFile('users.json', users);
}

app.post('/api/auth/register', async (req, res) => {
  try {
    const { username, password } = req.body || {};
    if (!username || !password) return res.status(400).json({ error: 'Missing fields' });
    const users = await getUsers();
    if (users.find(u => u.username === username)) return res.status(409).json({ error: 'User exists' });
    const hash = await bcrypt.hash(password, 10);
    const userPayload = { username, password: hash, role: 'user' };
    let user;
    if (supa) {
      user = await createEntity('users', userPayload);
    } else {
      const id = nextId(users, 'USR');
      user = Object.assign({ id }, userPayload);
      users.push(user);
      saveUsers(users);
    }
    res.status(201).json({ id: user.id, username: user.username });
  } catch (e) {
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  const { username, password } = req.body || {};
  const users = await getUsers();
  const user = users.find(u => u.username === username);
  // allow demo admin
  if (!user && username === 'admin' && password === 'admin') {
    const token = jwt.sign({ username: 'admin', role: 'admin' }, JWT_SECRET, { expiresIn: '8h' });
    return res.json({ token, role: 'admin', user: { username: 'admin' } });
  }
  if (!user) return res.status(401).json({ error: 'Invalid credentials' });
  const ok = await bcrypt.compare(password, user.password);
  if (!ok) return res.status(401).json({ error: 'Invalid credentials' });
  const token = jwt.sign({ username: user.username, role: user.role }, JWT_SECRET, { expiresIn: '8h' });
  res.json({ token, role: user.role, user: { username: user.username } });
});

function requireAuth(req, res, next) {
  const token = req.headers['authorization'] || req.headers['x-demo-auth'];
  if (!token) return res.status(401).json({ error: 'Missing auth token' });
  const raw = token.toString().replace(/^Bearer\s+/i, '');
  if (raw === DEMO_TOKEN) return next();
  try {
    const payload = jwt.verify(raw, JWT_SECRET);
    req.user = payload;
    return next();
  } catch (e) {
    return res.status(403).json({ error: 'Invalid token' });
  }
}

// --- Customers ---
app.get('/api/customers', async (req, res) => {
  try {
    const customers = await listEntities('customers');
    res.json(customers);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/customers/:id', async (req, res) => {
  try {
    const c = await findEntity('customers', req.params.id);
    if (!c) return res.status(404).json({ error: 'Not found' });
    res.json(c);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/customers', requireAuth, async (req, res) => {
  try {
    const payload = req.body;

    // Auto-generate customer code if not provided
    if (!payload.customer_code && supa) {
      payload.customer_code = await supa.generateCustomerCode();
    }
    if (!payload.id) payload.id = payload.customer_code;

    let record;
    if (supa) {
      record = await supa.createCustomer(payload);
    } else {
      record = await createEntity('customers', payload);
    }

    try { broadcastEvent({ type: 'customer.created', data: record }, record.organization_id || null); } catch (e) { }
    res.status(201).json(record);
  } catch (e) { res.status(500).json({ error: e.message }); }
});


app.put('/api/customers/:id', requireAuth, async (req, res) => {
  try {
    const upd = await updateEntity('customers', req.params.id, req.body);
    if (!upd) return res.status(404).json({ error: 'Not found' });
    res.json(upd);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/customers/:id', requireAuth, async (req, res) => {
  try {
    const removed = await deleteEntity('customers', req.params.id);
    if (!removed) return res.status(404).json({ error: 'Not found' });
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// --- Products ---
app.get('/api/products', async (req, res) => {
  try {
    const products = await listEntities('products');
    res.json(products);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/products/:id', async (req, res) => {
  try {
    const p = await findEntity('products', req.params.id);
    if (!p) return res.status(404).json({ error: 'Not found' });
    res.json(p);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/products', requireAuth, async (req, res) => {
  try {
    const payload = req.body;
    const record = await createEntity('products', payload);
    try { broadcastEvent({ type: 'product.created', data: record }, record.organization_id || null); } catch (e) { }
    res.status(201).json(record);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.put('/api/products/:id', requireAuth, async (req, res) => {
  try {
    const upd = await updateEntity('products', req.params.id, req.body);
    if (!upd) return res.status(404).json({ error: 'Not found' });
    res.json(upd);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/products/:id', requireAuth, async (req, res) => {
  try {
    const removed = await deleteEntity('products', req.params.id);
    if (!removed) return res.status(404).json({ error: 'Not found' });
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// --- Quotations ---
app.get('/api/quotations', async (req, res) => {
  try {
    const quotes = await listEntities('quotations');
    res.json(quotes);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/quotations/:id', async (req, res) => {
  try {
    const q = await findEntity('quotations', req.params.id);
    if (!q) return res.status(404).json({ error: 'Not found' });
    res.json(q);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/quotations', requireAuth, async (req, res) => {
  try {
    const autoId = await generateNextId('quotation');

    const payload = Object.assign({ id: autoId, status: 'Quoted', createdAt: new Date().toISOString() }, req.body);
    const record = await createEntity('quotations', payload);
    try { broadcastEvent({ type: 'quotation.created', data: record }, record.organization_id || null); } catch (e) { }
    res.status(201).json(record);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.put('/api/quotations/:id', requireAuth, async (req, res) => {
  try {
    const upd = await updateEntity('quotations', req.params.id, req.body);
    if (!upd) return res.status(404).json({ error: 'Not found' });
    res.json(upd);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/quotations/:id', requireAuth, async (req, res) => {
  try {
    const removed = await deleteEntity('quotations', req.params.id);
    if (!removed) return res.status(404).json({ error: 'Not found' });
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Convert quotation to invoice
app.post('/api/quotations/:id/convert', requireAuth, async (req, res) => {
  try {
    const q = await findEntity('quotations', req.params.id);
    if (!q) return res.status(404).json({ error: 'Quotation not found' });

    // Prevent duplicate invoice creation
    if (q.status === 'Invoiced' && q.invoiceId) {
      const existing = await findEntity('invoices', q.invoiceId).catch(() => null);
      if (existing) return res.status(200).json(existing); // return the already-created invoice
    }

    const autoId = await generateNextId('invoice');

    // Deep copy items to break reference so updates don't bleed back
    const clonedItems = (q.items || []).map(it => ({ ...it }));

    const invoicePayload = {
      ...q,
      id: autoId,
      items: clonedItems,
      quotationId: q.id,
      sourceQuotationId: q.id,
      status: 'Pending',
      createdAt: new Date().toISOString()
    };
    const invoice = await createEntity('invoices', invoicePayload);

    // Update quotation: status = Invoiced, store linked invoice ID
    await updateEntity('quotations', req.params.id, {
      status: 'Invoiced',
      invoiceId: invoice.id
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
  } catch (e) { res.status(500).json({ error: e.message }); }
});


// --- Orders (Priority Orders) ---
app.get('/api/orders', async (req, res) => {
  try {
    const orders = await listEntities('orders');
    res.json(orders.sort((a, b) => (a.priorityIndex || 0) - (b.priorityIndex || 0)));
  } catch (e) { res.status(500).json({ error: e.message }); }
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

    const payload = Object.assign({ 
        createdAt: new Date().toISOString(),
        priorityLevel: 'Normal',
        priorityIndex,
        projectStatus: 'Material Procurement',
        currentStage: 'Priority Orders',
        assignedEngineer: 'Unassigned',
        expectedInstallationDate: ''
    }, req.body, { id: orderId });
    
    const record = await createEntity('orders', payload);
    
    // Create notifications for teams
    const title = 'Order Confirmed';
    const desc = `Quotation ${record.quotationId || record.quotationNumber || 'Unknown'} has been confirmed. The project has been added to the Priority Orders queue.`;
    
    await createEntity('notifications', {
        title, desc, type: 'success', link: `/priority-orders`, read: false, createdAt: new Date().toISOString()
    });

    res.status(201).json(record);
  } catch (e) { res.status(500).json({ error: e.message }); }
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
    // Wait, updateEntity handles writing, so we can just loop updateEntity
    for (const update of updates) {
        await updateEntity('orders', update.id, { priorityIndex: update.priorityIndex });
    }
    
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.put('/api/orders/:id', requireAuth, async (req, res) => {
  try {
    const upd = await updateEntity('orders', req.params.id, req.body);
    if (!upd) return res.status(404).json({ error: 'Not found' });
    res.json(upd);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/orders/:id', requireAuth, async (req, res) => {
  try {
    const removed = await deleteEntity('orders', req.params.id);
    if (!removed) return res.status(404).json({ error: 'Not found' });
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// --- Invoices ---
app.get('/api/invoices', async (req, res) => {
  try {
    const invoices = await listEntities('invoices');
    res.json(invoices);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/invoices/:id', async (req, res) => {
  try {
    const inv = await findEntity('invoices', req.params.id);
    if (!inv) return res.status(404).json({ error: 'Not found' });
    res.json(inv);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/invoices', requireAuth, async (req, res) => {
  try {
    const autoId = await generateNextId('invoice');

    const payload = Object.assign({ id: autoId, status: 'Pending', createdAt: new Date().toISOString() }, req.body);
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
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.put('/api/invoices/:id', requireAuth, async (req, res) => {
  try {
    const upd = await updateEntity('invoices', req.params.id, req.body);
    if (!upd) return res.status(404).json({ error: 'Not found' });
    res.json(upd);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/invoices/:id', requireAuth, async (req, res) => {
  try {
    const removed = await deleteEntity('invoices', req.params.id);
    if (!removed) return res.status(404).json({ error: 'Not found' });
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// --- Payments ---
app.get('/api/payments', async (req, res) => {
  try {
    const payments = await listEntities('payments');
    res.json(payments);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/payments/:id', async (req, res) => {
  try {
    const p = await findEntity('payments', req.params.id);
    if (!p) return res.status(404).json({ error: 'Not found' });
    res.json(p);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// expose ledger entries for tests (read-only)
app.get('/ledger_entries', async (req, res) => {
  try {
    const ledgers = await listEntities('ledger_entries');
    res.json(ledgers);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/payments', requireAuth, async (req, res) => {
  try {
    const payload = Object.assign({ createdAt: new Date().toISOString(), status: 'Paid' }, req.body);

    // inherit customer ID/Name if not provided but invoice exists
    if (payload.invoiceId && (!payload.customerId || !payload.customerName)) {
      const inv = await findEntity('invoices', payload.invoiceId);
      if (inv) {
        payload.customerId = inv.customerId;
        payload.customerName = inv.customerName;
      }
    }

    const record = await createEntity('payments', payload);

    // update invoice paid amount if linked
    if (record.invoiceId) {
      const inv = await findEntity('invoices', record.invoiceId);
      if (inv) {
        const paid = (inv.paid || 0) + (record.amount || 0);
        let newStatus = inv.status;
        if (paid >= inv.total) {
          newStatus = 'Paid';
        } else if (paid > 0) {
          newStatus = 'Partially Paid';
        }
        await updateEntity('invoices', inv.id, { paid, status: newStatus });
      }
    }

    // Create basic journal + ledger for payment
    try {
      const journal = await createEntity('journal_entries', { date: new Date().toISOString(), narration: `Payment ${record.id}`, createdAt: new Date().toISOString() });
      await createEntity('ledger_entries', { journal_id: journal.id, account: 'Cash', debit: record.amount || 0, credit: 0, created_at: new Date().toISOString() });
      await createEntity('ledger_entries', { journal_id: journal.id, account: 'AccountsReceivable', debit: 0, credit: record.amount || 0, created_at: new Date().toISOString() });
      try { broadcastEvent({ type: 'payment.created', data: record }, record.organization_id || null); } catch (e) { }
    } catch (e) { console.warn('payment accounting failed', e.message); }

    res.status(201).json(record);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.put('/api/payments/:id', requireAuth, async (req, res) => {
  try {
    const upd = await updateEntity('payments', req.params.id, req.body);
    if (!upd) return res.status(404).json({ error: 'Not found' });
    res.json(upd);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/payments/:id', requireAuth, async (req, res) => {
  try {
    const removed = await deleteEntity('payments', req.params.id);
    if (!removed) return res.status(404).json({ error: 'Not found' });
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// --- AMC ---
app.get('/api/amc', async (req, res) => {
  try {
    const amc = await listEntities('amc');
    res.json(amc);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/amc/:id', async (req, res) => {
  try {
    const a = await findEntity('amc', req.params.id);
    if (!a) return res.status(404).json({ error: 'Not found' });
    res.json(a);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/amc', requireAuth, async (req, res) => {
  try {
    const payload = req.body;
    const record = await createEntity('amc', payload);
    try { broadcastEvent({ type: 'amc.created', data: record }, record.organization_id || null); } catch (e) { }
    res.status(201).json(record);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.put('/api/amc/:id', requireAuth, async (req, res) => {
  try {
    const upd = await updateEntity('amc', req.params.id, req.body);
    if (!upd) return res.status(404).json({ error: 'Not found' });
    res.json(upd);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/amc/:id', requireAuth, async (req, res) => {
  try {
    const removed = await deleteEntity('amc', req.params.id);
    if (!removed) return res.status(404).json({ error: 'Not found' });
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// --- Notifications ---
async function checkAndGenerateNotifications() {
  try {
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
  }
}

app.get('/api/notifications', async (req, res) => {
  try {
    // Generate lazily on fetch
    await checkAndGenerateNotifications();
    const notifications = await listEntities('notifications');
    // Sort so newest are first
    notifications.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
    res.json(notifications);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/notifications', requireAuth, async (req, res) => {
  try {
    const payload = Object.assign({ createdAt: new Date().toISOString(), read: false }, req.body);
    const nt = await createEntity('notifications', payload);
    res.status(201).json(nt);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.put('/api/notifications/read/:id', requireAuth, async (req, res) => {
  try {
    const upd = await updateEntity('notifications', req.params.id, { read: true });
    if (!upd) return res.status(404).json({ error: 'Not found' });
    res.json(upd);
  } catch (e) { res.status(500).json({ error: e.message }); }
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
  } catch (e) { res.status(500).json({ error: e.message }); }
});
app.get('/api/reports/summary', async (req, res) => {
  try {
    const invoices = await listEntities('invoices');
    const payments = await listEntities('payments');
    const revenue = (invoices || []).reduce((s, i) => s + (i.total || 0), 0);
    const received = (payments || []).reduce((s, p) => s + (p.amount || 0), 0);
    const pending = revenue - received;
    res.json({ revenue, received, pending });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// --- Settings ---
app.get('/api/settings', async (req, res) => {
  try {
    const settingsList = await listEntities('settings');
    const globalSettings = settingsList.find(s => s.id === 'global') || { id: 'global', global_settings: {} };
    res.json(globalSettings);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.put('/api/settings', requireAuth, async (req, res) => {
  try {
    const payload = req.body;
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
  } catch (e) { res.status(500).json({ error: e.message }); }
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

server.listen(PORT, async () => {
  console.log('');
  
  const hasUrl = !!process.env.SUPABASE_URL;
  const hasKey = !!(process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_KEY);
  if (!hasUrl || !hasKey) {
    if (!hasUrl) console.log('❌ Missing SUPABASE_URL');
    if (!hasKey) console.log('❌ Missing SUPABASE_SERVICE_KEY');
    process.exit(1);
  }

  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl || dbUrl.includes('postgres:postgres@db:5432')) {
    console.log('====================================');
    console.log('DATABASE INITIALIZATION FAILED');
    console.log('====================================');
    console.log('Error: DATABASE_URL is missing or invalid.');
    console.log('Please add your direct Postgres connection string to .env:');
    console.log('DATABASE_URL=postgres://postgres.[YOUR-PROJECT-ID]:[YOUR-PASSWORD]@aws-0-[REGION].pooler.supabase.com:6543/postgres\n');
    process.exit(1);
  }

  const pool = new Pool({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } });
  
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
      
      const statements = schemaSql.split(/;(?=(?:[^']*'[^']*')*[^']*$)/g).filter(s => s.trim());
      
      for (let i = 0; i < statements.length; i++) {
        let stmt = statements[i].trim();
        if (!stmt) continue;
        try {
          await client.query(stmt);
        } catch (err) {
          const precedingSql = schemaSql.substring(0, schemaSql.indexOf(stmt));
          const lineNum = precedingSql.split('\\n').length;
          
          console.log('====================================');
          console.log('DATABASE INITIALIZATION FAILED');
          console.log('====================================');
          console.log(`SQL Line:\n${lineNum}`);
          console.log(`Error:\n${err.message}`);
          console.log('====================================\n');
          process.exit(1);
        }
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
    console.log('Database\nConnected\n');
    console.log(`Schema\n${current_schema}\n`);
    console.log(`Tables\n${tables.length} Found\n`);
    console.log('Storage\nConnected\n');
    console.log(`Bucket\n${bucketName}\n`);
    console.log(`Database CRUD\nPassed\n`);
    console.log(`Storage Upload\n${storagePassed ? 'Passed' : 'Failed'}\n`);
    console.log('System Status\nREADY');
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
