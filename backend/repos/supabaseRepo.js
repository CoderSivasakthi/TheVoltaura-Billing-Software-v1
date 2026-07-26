// ═══════════════════════════════════════════════════════════════════════
// supabaseRepo.js — Typed Supabase operations for TheVoltaura ERP
// Uses service_role key (bypasses RLS) — NEVER expose to frontend
// ═══════════════════════════════════════════════════════════════════════
'use strict';

const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL  = process.env.SUPABASE_URL;
const SERVICE_KEY   = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_KEY;

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false },
});

async function checkTables() {
  try {
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

};
function resolveTable(name) { return TABLE_MAP[name] || name; }

async function list(table) {
  const resolved = resolveTable(table);
  let query = supabase.from(resolved).select('*');
  // Only order by created_at if the table is expected to have it
  if (resolved !== 'company_settings' && resolved !== 'settings') {
    query = query.order('created_at', { ascending: false });
  }
  const { data, error } = await query;
  if (error) { 
    logError('list', table, error); 
    return null; 
  }
  return data || [];
}

async function create(table, payload) {
  const { data, error } = await supabase
    .from(resolveTable(table))
    .insert([payload])
    .select()
    .single();
  if (error) { 
    logError('create', table, error, payload); 
    return null; 
  }
  logOperation('create', table, payload);
  return data;
}

async function find(table, id) {
  const { data, error } = await supabase
    .from(resolveTable(table))
    .select('*')
    .eq('id', id)
    .single();
  if (error && error.code !== 'PGRST116') { 
    logError('read', table, error, { id }); 
    return null; 
  }
  return data || null;
}

async function update(table, id, updates) {
  const { data, error } = await supabase
    .from(resolveTable(table))
    .update(updates)
    .eq('id', id)
    .select()
    .single();
  if (error) { 
    logError('update', table, error, { id, updates }); 
    return null; 
  }
  logOperation('update', table, updates);
  return data;
}

async function remove(table, id) {
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
  const resolved = resolveTable(table);
  let query = supabase.from(resolved).select('*').order('created_at', { ascending: false });
  if (franchiseId) {
    query = query.eq('franchise_id', franchiseId);
  } else if (tenantId && tenantId !== 'admin') {
    query = query.eq('tenant_id', tenantId);
  }
  const { data, error } = await query;
  if (error) { logError('list', table, error); return []; }
  return data || [];
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
  const [quotations, invoices] = await Promise.all([
    supabase.from('quotations')
      .select('id, franchise_id, customer_name, project_size, grand_total, submitted_at, approval_status')
      .eq('approval_status', 'Submitted')
      .order('submitted_at', { ascending: true }),
    supabase.from('invoices')
      .select('id, franchise_id, customer_name, grand_total, submitted_at, approval_status')
      .eq('approval_status', 'Submitted')
      .order('submitted_at', { ascending: true }),
  ]);

  // Attach franchise name
  const { data: allFranchises } = await supabase.from('franchises').select('id, name, franchise_code');
  const frMap = {};
  (allFranchises || []).forEach(f => { frMap[f.id] = f; });

  const annotated = (data, type) => (data || []).map(item => ({
    ...item,
    type,
    franchise_name: frMap[item.franchise_id]?.name || item.franchise_id,
    franchise_code: frMap[item.franchise_id]?.franchise_code || '',
  }));

  return {
    quotations: annotated(quotations.data, 'quotation'),
    invoices:   annotated(invoices.data, 'invoice'),
    total:      (quotations.data?.length || 0) + (invoices.data?.length || 0),
  };
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
  list, create, find, update, remove, checkTables,
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
