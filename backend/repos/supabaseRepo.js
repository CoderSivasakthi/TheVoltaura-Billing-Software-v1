// ═══════════════════════════════════════════════════════════════════════
// supabaseRepo.js — Typed Supabase operations for TheVoltaura ERP
// Uses service_role key (bypasses RLS) — NEVER expose to frontend
// ═══════════════════════════════════════════════════════════════════════
'use strict';

const dns = require('dns').promises;
const { createClient } = require('@supabase/supabase-js');
const { mapToDb, enrichRecord, extractUnknownColumn } = require('../utils/rowMapper');

const SUPABASE_URL  = String(process.env.SUPABASE_URL || '').trim().replace(/\/$/, '');
const SERVICE_KEY   = String(process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_KEY || '').trim();

let supabase = null;

function isAvailable() {
  return Boolean(supabase);
}

function markUnreachable(reason) {
  const msg = reason && reason.message ? reason.message : String(reason || 'network error');
  console.warn('[supabaseRepo] Transient Supabase error:', msg.replace(/https?:\/\/[^\s]+/g, '[url]'));
}

if (SUPABASE_URL && SERVICE_KEY) {
  const fetchWithTimeout = (url, options = {}) => {
    const ctrl = new AbortController();
    const ms = 15000;
    const timer = setTimeout(() => ctrl.abort(), ms);
    if (options.signal) {
      if (options.signal.aborted) ctrl.abort();
      else options.signal.addEventListener('abort', () => ctrl.abort(), { once: true });
    }
    return fetch(url, { ...options, signal: ctrl.signal })
      .catch((err) => {
        markUnreachable(err);
        throw err;
      })
      .finally(() => clearTimeout(timer));
  };
  supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { persistSession: false },
    global: { fetch: fetchWithTimeout },
  });
} else {
  console.warn('[supabaseRepo] SUPABASE_URL / key not set — database operations will fail until configured.');
}

async function checkTables() {
  try {
    if (!supabase) return false;
    const { error } = await supabase.from('customers').select('id').limit(1);
    return !error && (!error?.code?.includes('PGRST'));
  } catch (e) {
    return false;
  }
}

// ── Logging Helper ──────────────────────────────────────────────────────
function logOperation(action, table, payload = null) {
  const tableSingular = {
    'customers': 'Customer',
    'quotations': 'Quotation',
    'invoices': 'Invoice',
    'payments': 'Payment',
    'orders': 'Order',
    'settings': 'Settings'
  }[table] || table;

  const actionMap = {
    'create': 'Create',
    'update': 'Update',
    'delete': 'Delete',
    'read': 'Read'
  }[action] || action;

  console.log('[DATABASE]');
  console.log(`${actionMap} ${tableSingular}`);
  console.log('Using Supabase');
  console.log('SUCCESS');
  if (payload && payload.id) {
    console.log(`${tableSingular} ID`);
    console.log(payload.id);
  }
}

function logError(action, table, error, payload = null) {
  const tableSingular = {
    'customers': 'Customer',
    'quotations': 'Quotation',
    'invoices': 'Invoice',
    'payments': 'Payment',
    'orders': 'Order',
    'settings': 'Settings'
  }[table] || table;

  const actionMap = {
    'create': 'Create',
    'update': 'Update',
    'delete': 'Delete',
    'read': 'Read'
  }[action] || action;

  console.log('[DATABASE]');
  console.log(`${actionMap} ${tableSingular}`);
  console.log('Using Supabase');
  console.log('FAILED');
  console.log(`Error: ${error.message}`);
  if (error.code) console.log(`Code: ${error.code}`);
  if (error.details) console.log(`Details: ${error.details}`);
  if (error.hint) console.log(`Hint: ${error.hint}`);
}

// ── Generic CRUD (used by existing server.js routes) ─────────────────

// Map logical entity names to actual Supabase table names
const TABLE_MAP = {
  settings: 'settings',
  amc: 'amc',
};

const TABLE_ALIASES = {
  settings: ['settings', 'company_settings'],
  amc: ['amc', 'amc_contracts'],
};

function resolveTable(name) { return TABLE_MAP[name] || name; }

function tableCandidates(name) {
  const resolved = resolveTable(name);
  const aliases = TABLE_ALIASES[name] || TABLE_ALIASES[resolved] || [];
  return [...new Set([resolved, ...aliases])];
}

function isMissingTable(error) {
  const msg = String(error?.message || error?.details || '');
  const code = String(error?.code || '');
  return code === '42P01' || code === 'PGRST205' || /could not find the table|does not exist|schema cache/i.test(msg);
}

function isNetworkError(error) {
  const msg = String(error?.message || error?.details || error);
  return /fetch failed|ENOTFOUND|AbortError|aborted|timeout|ECONN|network/i.test(msg);
}

function isMissingColumn(error) {
  const msg = String(error?.message || error?.details || '');
  return /column|order|created_at/i.test(msg) && /does not exist|could not find/i.test(msg);
}

function normalizeSettingsRows(table, rows) {
  if (table !== 'company_settings') return rows;
  return rows.map((row) => ({
    ...row,
    id: row.id || 'global',
    global_settings: row.global_settings || {
      orgName: row.company_name,
      logo: row.logo_url,
      website: row.website,
      email: row.support_email,
      phone: row.support_phone,
    },
  }));
}

async function queryTable(table, { orderCreatedAt = true } = {}) {
  let query = supabase.from(table).select('*');
  if (orderCreatedAt && table !== 'company_settings' && table !== 'settings') {
    query = query.order('created_at', { ascending: false });
  }
  return query;
}

function parentIdColumn(table) {
  if (table === 'quotations') return 'quotation_id';
  if (table === 'invoices') return 'invoice_id';
  return null;
}

function lineItemTable(table) {
  if (table === 'quotations') return 'quotation_items';
  if (table === 'invoices') return 'invoice_items';
  return null;
}

function normalizeLineItem(it, parentCol, parentId, index) {
  return {
    [parentCol]: parentId,
    product_id: it.product_id || it.productId || null,
    product_name: it.product_name || it.productName || it.name || 'Item',
    description: it.description || '',
    hsn_code: it.hsn_code || it.hsnCode || it.hsn || '',
    qty: Number(it.qty || it.quantity || 1),
    unit: it.unit || 'Nos',
    price: Number(it.price || it.rate || 0),
    gst_rate: Number(it.gst_rate || it.gstRate || 18),
    sort_order: index,
  };
}

async function replaceLineItems(table, parentId, items) {
  const child = lineItemTable(table);
  const parentCol = parentIdColumn(table);
  if (!supabase || !child || !parentCol || !parentId || !Array.isArray(items)) return;
  const rows = items
    .filter((it) => it && (it.product_name || it.productName || it.name))
    .map((it, i) => normalizeLineItem(it, parentCol, parentId, i));
  await supabase.from(child).delete().eq(parentCol, parentId);
  if (rows.length) {
    const { error } = await supabase.from(child).insert(rows);
    if (error) console.warn('[supabaseRepo] line items insert failed:', error.message);
  }
}

async function fetchLineItems(table, parentId) {
  const child = lineItemTable(table);
  const parentCol = parentIdColumn(table);
  if (!supabase || !child || !parentCol || !parentId) return [];
  const { data, error } = await supabase.from(child).select('*').eq(parentCol, parentId).order('sort_order', { ascending: true });
  if (error) return [];
  return (data || []).map((it) => ({
    ...it,
    productId: it.product_id,
    productName: it.product_name,
    hsnCode: it.hsn_code,
    gstRate: it.gst_rate,
    quantity: it.qty,
  }));
}

async function attachLineItemsIfNeeded(table, rows) {
  if (!Array.isArray(rows) || (table !== 'quotations' && table !== 'invoices')) return rows;
  return Promise.all(rows.map(async (row) => {
    if (Array.isArray(row.items) && row.items.length > 0) return row;
    row.items = await fetchLineItems(table, row.id);
    return row;
  }));
}

async function list(table) {
  if (!isAvailable()) return null;
  const candidates = tableCandidates(table);
  let lastError = null;
  for (const candidate of candidates) {
    for (const orderCreatedAt of [true, false]) {
      try {
        const { data, error } = await queryTable(candidate, { orderCreatedAt });
        if (error) {
          lastError = error;
          if (isNetworkError(error)) {
            markUnreachable(error);
            return null;
          }
          if (orderCreatedAt && isMissingColumn(error)) continue;
          if (isMissingTable(error)) break;
          continue;
        }
        const rows = normalizeSettingsRows(candidate, (data || []).map(enrichRecord));
        return attachLineItemsIfNeeded(resolveTable(table), rows);
      } catch (e) {
        lastError = e;
        if (isNetworkError(e) || /circuit open/i.test(String(e && e.message))) {
          markUnreachable(e);
          return null;
        }
      }
    }
  }
  if (lastError) logError('list', table, lastError);
  return [];
}

async function mutateWithColumnFallback(table, row, mutator) {
  let current = { ...row };
  const quotationStatusMap = {
    Quoted: 'Sent',
    'Ready for Approval': 'Sent',
    'Documents Pending': 'Draft',
    Invoiced: 'Converted',
    'Confirmed Order': 'Accepted',
    Installation: 'Accepted',
    Completed: 'Accepted',
    'Quotation Sent': 'Sent',
    'Advance Pending': 'Sent',
    'Advance Received': 'Accepted',
  };
  const invoiceStatusMap = {
    Partial: 'Partially Paid',
    'Partially Paid': 'Partially Paid',
  };
  for (let i = 0; i < 25; i++) {
    const { data, error } = await mutator(current);
    if (!error) return data;
    const msg = String(error?.message || error?.details || '');
    const col = extractUnknownColumn(error);
    if (col && Object.prototype.hasOwnProperty.call(current, col)) {
      delete current[col];
      continue;
    }
    if (/chk_quotation_status|quotations_status_check/i.test(msg) && current.status && quotationStatusMap[current.status]) {
      current.status = quotationStatusMap[current.status];
      continue;
    }
    if (/chk_invoice_status|invoices_status_check/i.test(msg) && current.status && invoiceStatusMap[current.status]) {
      current.status = invoiceStatusMap[current.status];
      continue;
    }
    logError('update', table, error, current);
    return null;
  }
  return null;
}

async function create(table, payload) {
  if (!isAvailable()) return null;
  const resolved = resolveTable(table);
  const row = mapToDb(payload);
  const data = await mutateWithColumnFallback(resolved, row, (current) =>
    supabase.from(resolved).insert([current]).select().single()
  );
  if (!data) {
    logError('create', table, { message: 'insert failed after column fallback' }, payload);
    return null;
  }
  logOperation('create', table, data);
  const record = enrichRecord(data);
  if (payload && payload.items) {
    await replaceLineItems(resolved, record.id, payload.items);
    record.items = await fetchLineItems(resolved, record.id);
  }
  return record;
}

async function find(table, id) {
  if (!isAvailable()) return null;
  const resolved = resolveTable(table);
  const { data, error } = await supabase
    .from(resolved)
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (error && error.code !== 'PGRST116') {
    if (isNetworkError(error)) markUnreachable(error);
    logError('read', table, error, { id });
    return null;
  }
  if (!data) return null;
  const record = enrichRecord(data);
  if (resolved === 'quotations' || resolved === 'invoices') {
    if (!Array.isArray(record.items) || record.items.length === 0) {
      record.items = await fetchLineItems(resolved, id);
    }
  }
  return record;
}

async function update(table, id, updates) {
  if (!isAvailable()) return null;
  const resolved = resolveTable(table);
  const row = mapToDb(updates);
  delete row.id;
  const data = await mutateWithColumnFallback(resolved, row, (current) =>
    supabase.from(resolved).update(current).eq('id', id).select().single()
  );
  if (!data) {
    logError('update', table, { message: 'update failed after column fallback' }, { id, updates });
    return null;
  }
  logOperation('update', table, data);
  const record = enrichRecord(data);
  if (updates && updates.items) {
    await replaceLineItems(resolved, id, updates.items);
    record.items = await fetchLineItems(resolved, id);
  }
  return record;
}

async function remove(table, id) {
  if (!isAvailable()) return null;
  const { data, error } = await supabase
    .from(resolveTable(table))
    .delete()
    .eq('id', id)
    .select()
    .single();
  if (error) { 
    logError('delete', table, error, { id }); 
    return null; 
  }
  logOperation('delete', table, { id });
  return data;
}

// ── Typed Operations ─────────────────────────────────────────────────

// Generate next customer code
async function generateCustomerCode() {
  const { data, error } = await supabase.rpc('generate_customer_code');
  if (!error && data) return data;

  // Fallback: get highest existing ID
  const { data: latest } = await supabase
    .from('customers')
    .select('id')
    .order('id', { ascending: false })
    .limit(1);

  let nextNum = 1;
  if (latest && latest.length > 0 && latest[0].id) {
    const match = latest[0].id.match(/CUST-(\d+)/);
    if (match) nextNum = parseInt(match[1], 10) + 1;
  }
  return `CUST-${String(nextNum).padStart(6, '0')}`;
}

// Create a customer
async function createCustomer(payload) {
  

  const customerCode = payload.customer_code || await generateCustomerCode();

  const insertPayload = {
    ...payload,
    customer_code: customerCode,
    id:            payload.id || customerCode,
  };

  const { data, error } = await supabase
    .from('customers')
    .insert([insertPayload])
    .select()
    .single();

  if (error) { console.error('Supabase createCustomer error:', error.message); return null; }
  return data;
}

// Get a customer with all their documents
async function getCustomerWithDocuments(customerId) {
  

  const [customerRes, docsRes] = await Promise.all([
    supabase.from('customers').select('*').eq('id', customerId).single(),
    supabase.from('customer_documents')
      .select('*')
      .eq('customer_id', customerId)
      .eq('is_deleted', false)
      .order('uploaded_at', { ascending: false }),
  ]);

  if (customerRes.error) return null;

  return {
    ...customerRes.data,
    documents: docsRes.data || [],
  };
}

// Create a document metadata record
async function createDocumentRecord(metadata) {
  

  const { data, error } = await supabase
    .from('customer_documents')
    .insert([metadata])
    .select()
    .single();

  if (error) { console.error('Supabase createDocumentRecord error:', error.message); return null; }
  return data;
}

// Soft-delete a document record
async function softDeleteDocument(documentId, deletedBy) {
  

  const { data, error } = await supabase
    .from('customer_documents')
    .update({
      is_deleted: true,
      deleted_at: new Date().toISOString(),
      deleted_by: deletedBy,
    })
    .eq('id', documentId)
    .select()
    .single();

  if (error) { console.error('Supabase softDeleteDocument error:', error.message); return null; }
  return data;
}

// Get a document by ID to retrieve its Drive file ID
async function getDocumentById(documentId) {
  

  const { data, error } = await supabase
    .from('customer_documents')
    .select('*')
    .eq('id', documentId)
    .eq('is_deleted', false)
    .single();

  if (error) { return null; }
  return data;
}

// Get all documents for a customer
async function getCustomerDocuments(customerId) {
  

  const { data, error } = await supabase
    .from('customer_documents')
    .select('*')
    .eq('customer_id', customerId)
    .eq('is_deleted', false)
    .order('uploaded_at', { ascending: false });

  if (error) { return []; }
  return data || [];
}

// Write an audit log entry
async function writeAuditLog(entry) {
  try {
    await supabase.from('audit_logs').insert([{
      ...entry,
      created_at: new Date().toISOString(),
    }]);
  } catch (e) {
    console.warn('Audit log write failed:', e.message);
  }
}

// Get document version history for a quotation
async function getQuotationVersions(quotationId) {
  const { data } = await supabase
    .from('quotation_documents')
    .select('*')
    .eq('quotation_id', quotationId)
    .order('version_number', { ascending: false });
  return data || [];
}

// Get document version history for an invoice
async function getInvoiceVersions(invoiceId) {
  const { data } = await supabase
    .from('invoice_documents')
    .select('*')
    .eq('invoice_id', invoiceId)
    .order('version_number', { ascending: false });
  return data || [];
}

// ── Multi-Tenant Franchise Operations ────────────────────────────────────

/**
 * List records for a specific tenant (franchise-scoped query).
 * Super Admin passes tenant_id='admin' to get all, or specific franchise_id.
 */
async function listByTenant(table, tenantId, franchiseId) {
  if (!isAvailable()) return null;
  const resolved = resolveTable(table);
  let query = supabase.from(resolved).select('*').order('created_at', { ascending: false });
  if (franchiseId) {
    query = query.eq('franchise_id', franchiseId);
  } else if (tenantId && tenantId !== 'admin') {
    query = query.eq('tenant_id', tenantId);
  }
  const { data, error } = await query;
  if (error) { logError('list', table, error); return []; }
  const rows = (data || []).map(enrichRecord);
  return attachLineItemsIfNeeded(resolved, rows);
}

/**
 * Generate next Franchise ID (TVA-FR-0001 format).
 */
async function generateFranchiseId() {
  const { data, error } = await supabase.rpc('generate_franchise_id');
  if (!error && data) return data;

  const { data: latest } = await supabase
    .from('franchises')
    .select('id')
    .order('id', { ascending: false })
    .limit(1);

  let nextNum = 1;
  if (latest && latest.length > 0 && latest[0].id) {
    const match = latest[0].id.match(/TVA-FR-(\d+)/);
    if (match) nextNum = parseInt(match[1], 10) + 1;
  }
  return `TVA-FR-${String(nextNum).padStart(4, '0')}`;
}

/**
 * Create a new franchise account + franchise_admin user.
 */
async function createFranchise(payload, createdBy) {
  const franchiseId = payload.id || await generateFranchiseId();

  const franchise = {
    id:               franchiseId,
    franchise_code:   franchiseId,
    name:             payload.name,
    city:             payload.city || null,
    state:            payload.state || null,
    admin_name:       payload.adminName || null,
    admin_email:      payload.adminEmail || null,
    admin_phone:      payload.adminPhone || null,
    branch_address:   payload.branchAddress || null,
    status:           'Active',
    created_by:       createdBy || 'super_admin',
  };

  const { data: fr, error: frErr } = await supabase
    .from('franchises')
    .insert([franchise])
    .select()
    .single();

  if (frErr) { logError('create', 'franchises', frErr); return null; }

  // Also create the tenant_settings row
  await supabase.from('tenant_settings').insert([{
    franchise_id:     franchiseId,
    branch_address:   payload.branchAddress || null,
    contact_number:   payload.adminPhone || null,
    email:            payload.adminEmail || null,
  }]).select();

  logOperation('create', 'franchises', fr);
  return fr;
}

/**
 * Get KPI summary for a single franchise.
 */
async function getFranchiseDashboard(franchiseId) {
  const [customers, quotations, invoices, payments, orders] = await Promise.all([
    supabase.from('customers').select('id', { count: 'exact' }).eq('franchise_id', franchiseId),
    supabase.from('quotations').select('id, grand_total, approval_status, status', { count: 'exact' }).eq('franchise_id', franchiseId),
    supabase.from('invoices').select('id, grand_total, status, approval_status').eq('franchise_id', franchiseId),
    supabase.from('payments').select('amount').eq('franchise_id', franchiseId),
    supabase.from('orders').select('id, order_status').eq('franchise_id', franchiseId),
  ]);

  const totalRevenue = (invoices.data || [])
    .filter(i => i.status === 'Paid')
    .reduce((s, i) => s + Number(i.grand_total || 0), 0);

  const outstanding = (invoices.data || [])
    .filter(i => ['Pending', 'Partially Paid', 'Overdue'].includes(i.status))
    .reduce((s, i) => s + Number(i.grand_total || 0), 0);

  const pendingApprovals =
    (quotations.data || []).filter(q => q.approval_status === 'Submitted').length +
    (invoices.data || []).filter(i => i.approval_status === 'Submitted').length;

  return {
    franchise_id:       franchiseId,
    total_customers:    customers.count || 0,
    total_quotations:   quotations.count || 0,
    total_invoices:     (invoices.data || []).length,
    total_revenue:      totalRevenue,
    outstanding:        outstanding,
    pending_approvals:  pendingApprovals,
    active_orders:      (orders.data || []).filter(o => !['Completed', 'Cancelled'].includes(o.order_status)).length,
  };
}

/**
 * Get global aggregate dashboard for Super Admin.
 */
async function getSuperAdminDashboard() {
  const { data: franchiseSummaries } = await supabase
    .from('franchise_dashboard_summary')
    .select('*');

  const [allInvoices, allCustomers, allQuotations, pendingQ, pendingI] = await Promise.all([
    supabase.from('invoices').select('grand_total, status'),
    supabase.from('customers').select('id', { count: 'exact' }),
    supabase.from('quotations').select('id', { count: 'exact' }),
    supabase.from('quotations').select('id', { count: 'exact' }).eq('approval_status', 'Submitted'),
    supabase.from('invoices').select('id', { count: 'exact' }).eq('approval_status', 'Submitted'),
  ]);

  const totalRevenue = (allInvoices.data || [])
    .filter(i => i.status === 'Paid')
    .reduce((s, i) => s + Number(i.grand_total || 0), 0);

  const franchises = franchiseSummaries || [];
  const top = franchises.reduce((best, f) =>
    (!best || Number(f.total_revenue) > Number(best.total_revenue)) ? f : best, null);
  const bottom = franchises.reduce((worst, f) =>
    (!worst || Number(f.total_revenue) < Number(worst.total_revenue)) ? f : worst, null);

  return {
    total_franchises:       franchises.length,
    total_revenue:          totalRevenue,
    total_customers:        allCustomers.count || 0,
    total_quotations:       allQuotations.count || 0,
    pending_approvals:      (pendingQ.count || 0) + (pendingI.count || 0),
    pending_quotations:     pendingQ.count || 0,
    pending_invoices:       pendingI.count || 0,
    top_franchise:          top,
    bottom_franchise:       bottom,
    franchise_summaries:    franchises,
  };
}

/**
 * Get all pending approvals (quotations + invoices submitted by franchises).
 */
async function getPendingApprovals() {
  if (!isAvailable()) return { quotations: [], invoices: [], total: 0 };
  try {
  const [quotations, invoices] = await Promise.all([
    supabase.from('quotations')
      .select('*')
      .eq('approval_status', 'Submitted')
      .order('submitted_at', { ascending: true }),
    supabase.from('invoices')
      .select('*')
      .eq('approval_status', 'Submitted')
      .order('submitted_at', { ascending: true }),
  ]);

  // Attach franchise name
  const { data: allFranchises } = await supabase.from('franchises').select('id, name, franchise_code');
  const frMap = {};
  (allFranchises || []).forEach(f => { frMap[f.id] = f; });

  const annotated = (data, type) => (data || []).map(item => {
    const row = enrichRecord(item);
    return {
      ...row,
      type,
      customer_name: row.customer_name || row.customerName,
      grand_total: row.grand_total || row.grandTotal,
      project_size: row.system_size_kw || row.systemSizeKw,
      franchise_name: frMap[row.franchise_id]?.name || row.franchise_id,
      franchise_code: frMap[row.franchise_id]?.franchise_code || '',
    };
  });

  return {
    quotations: annotated(quotations.data, 'quotation'),
    invoices:   annotated(invoices.data, 'invoice'),
    total:      (quotations.data?.length || 0) + (invoices.data?.length || 0),
  };
  } catch (e) {
    console.warn('[getPendingApprovals]', e.message);
    return { quotations: [], invoices: [], total: 0 };
  }
}

/**
 * Write an approval action log entry.
 */
async function writeApprovalLog({ entityType, entityId, franchiseId, tenantId, action, performedBy, performedRole, comment, oldStatus, newStatus, ipAddress }) {
  try {
    await supabase.from('approval_logs').insert([{
      entity_type:    entityType,
      entity_id:      entityId,
      franchise_id:   franchiseId || null,
      tenant_id:      tenantId || 'admin',
      action,
      performed_by:   performedBy,
      performed_role: performedRole,
      comment:        comment || null,
      old_status:     oldStatus || null,
      new_status:     newStatus || null,
      ip_address:     ipAddress || null,
      created_at:     new Date().toISOString(),
    }]);
  } catch (e) {
    console.warn('[approvalLog] write failed:', e.message);
  }
}

/**
 * Get tenant_settings for a franchise.
 */
async function getTenantSettings(franchiseId) {
  const { data } = await supabase
    .from('tenant_settings')
    .select('*')
    .eq('franchise_id', franchiseId)
    .single();
  return data || null;
}

/**
 * Upsert tenant_settings for a franchise.
 */
async function upsertTenantSettings(franchiseId, updates, updatedBy) {
  const { data, error } = await supabase
    .from('tenant_settings')
    .upsert({ ...updates, franchise_id: franchiseId, updated_by: updatedBy, updated_at: new Date().toISOString() }, { onConflict: 'franchise_id' })
    .select()
    .single();
  if (error) { console.error('upsertTenantSettings error:', error.message); return null; }
  return data;
}

module.exports = {
  // Generic CRUD (used by existing server.js)
  list, create, find, update, remove, checkTables, isAvailable,
  // Typed operations
  generateCustomerCode,
  createCustomer,
  getCustomerWithDocuments,
  createDocumentRecord,
  softDeleteDocument,
  getDocumentById,
  getCustomerDocuments,
  writeAuditLog,
  getQuotationVersions,
  getInvoiceVersions,
  // Multi-tenant franchise operations
  listByTenant,
  generateFranchiseId,
  createFranchise,
  getFranchiseDashboard,
  getSuperAdminDashboard,
  getPendingApprovals,
  writeApprovalLog,
  getTenantSettings,
  upsertTenantSettings,
  rawClient: supabase,
};
